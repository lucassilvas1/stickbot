import { createWriteStream, renameSync, rmSync, statSync } from "fs";
import { env } from "../env.js";
import type {
  StickerVariant,
  StickerVariantEncodingConfig,
} from "../types/stickers.js";
import { Constants } from "./index.js";
import { spawn, type SpawnOptionsWithoutStdio } from "child_process";
import type { Dispatcher } from "undici";
import { extname, join } from "path";
import type { NewVariant } from "../types/db.js";
import { TypedError } from "./misc.js";
import sharp from "sharp";

export function saveFile(
  path: string,
  responseBody: Dispatcher.ResponseData<null>["body"]
) {
  const writeStream = createWriteStream(path);
  responseBody.pipe(writeStream);

  return new Promise<void>((resolve, reject) => {
    writeStream.on("finish", () => {
      resolve();
    });

    writeStream.on("error", (error) => {
      reject(new Error(`Failed to save file: ${error.message}`));
    });

    responseBody.on("error", (error) => {
      reject(new Error(`Stream error: ${error.message}`));
    });
  });
}

export async function processFile(
  inputPath: string,
  outputPath: string,
  options: StickerVariantEncodingConfig
): Promise<void> {
  try {
    await ffmpeg(inputPath, outputPath, options);
  } catch (error) {
    if (error instanceof TypedError) {
      const hint = "skipping unsupported chunk: ANMF";
      if (
        error.message.includes(hint) ||
        (error.cause as Error)?.message.includes(hint)
      ) {
        // The likely cause is ffmpeg being unable to decode animated WEBP.
        // Try again using sharp
        await processWebp(inputPath, outputPath, options);
      } else throw error;
    } else throw error;
  }
}

function run(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<string> {
  const process = spawn(command, args, options);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} failed with code ${code}: ${stderr}`));
      } else resolve(stdout);
    });

    process.on("error", (error) => {
      reject(new Error(`Failed to run ${command}: ${error}`));
    });

    process.stdin.on("error", (error) => {
      reject(new Error("stdin error: ", error));
    });
  });
}

async function ffmpeg(
  inputPath: string,
  outputPath: string,
  options: StickerVariantEncodingConfig
): Promise<void> {
  const tempPath = outputPath + ".part";

  // Build ffmpeg arguments
  const args = ["-i", inputPath];

  // Build scale filter to ensure height doesn't exceed the parameter, and resample fps if needed
  let filterChain = `scale='iw':'min(${options.height}\\,ih)':force_original_aspect_ratio=decrease`;
  if (options.frameRate) {
    filterChain += `,fps='min(${options.frameRate}\\,source_fps)'`;
  }
  args.push("-vf", filterChain);

  args.push("-t", String(Constants.MAX_VIDEO_DURATION_SECONDS)); // Trim to max duration
  args.push("-c:v", "libwebp"); // Use libwebp codec
  args.push("-loop", "0"); // Infinite loop for animated webp

  if (options.quality) args.push("-quality", String(options.quality));
  if (options.method) args.push("-method", String(options.method));
  if (options.maxBitrate) args.push("-maxrate", options.maxBitrate);
  if (options.bufSize) args.push("-bufsize", options.bufSize);

  args.push("-an"); // Disable audio

  args.push("-pix_fmt", "bgra"); // Force BGRA for transparency support
  args.push("-f", "webp"); // Specify output format
  args.push("-y", tempPath);

  try {
    await run(env.FFMPEG_PATH, args);
    renameSync(tempPath, outputPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw new TypedError("FFMPEG_ERROR", { cause: error });
  }
}

async function processWebp(
  inputPath: string,
  outputPath: string,
  options: StickerVariantEncodingConfig
) {
  if (inputPath.split(".").at(-1) !== "webp") {
    throw new TypedError("SHARP_ERROR", {
      message: "Sharp is currently only used to process webp files",
    });
  }

  let sharpBuilder = sharp(inputPath, { pages: -1 });

  const metadata = await sharpBuilder.metadata();

  if (metadata.height > options.height) {
    sharpBuilder.resize({ height: options.height, fit: "inside" });
  }

  return sharpBuilder
    .webp({ effort: options.method, quality: options.quality })
    .toFile(outputPath);
}

export function getVariantInfo(
  stickerId: string,
  type: StickerVariant,
  filePath: string
): Promise<NewVariant> {
  return new Promise((resolve, reject) => {
    // Get file size using fs.statSync
    let fileSizeBytes: number;
    try {
      fileSizeBytes = statSync(filePath).size;
    } catch (error) {
      reject(new TypedError("FFPROBE_ERROR", { cause: error }));
      return;
    }

    // Get extension
    const extension = extname(filePath).substring(1); // Remove leading dot

    // Use ffprobe to get video/image dimensions and frame count
    const ffprobe = spawn(env.FFPROBE_PATH, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,nb_read_frames",
      "-count_frames",
      "-of",
      "csv=p=0",
      filePath,
    ]);

    let output = "";
    let stderrOutput = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(
          new TypedError("FFPROBE_ERROR", {
            message: stderrOutput ?? `Exit code ${code}`,
          })
        );
      } else {
        const parts = output.trim().split(",").map(Number);
        const width = parts[0];
        const height = parts[1];
        const frameCount = parts[2];
        if (
          parts.length < 2 ||
          width === undefined ||
          height === undefined ||
          isNaN(width) ||
          isNaN(height)
        ) {
          reject(
            new TypedError("FFPROBE_ERROR", {
              message: "Could not extract width and height from media file",
            })
          );
        } else {
          resolve({
            stickerId,
            type,
            width,
            height,
            fileSizeBytes,
            extension,
            animated: ~~(frameCount !== undefined && frameCount > 1),
          });
        }
      }
    });

    ffprobe.on("error", (error) => {
      reject(new TypedError("FFPROBE_ERROR", { cause: error }));
    });
  });
}

export function getVariantPaths(stickerId: string, originalExtension: string) {
  const paths = Object.values(Constants.VariantEncodingMap).map(({ dirName }) =>
    join(env.ASSETS_DIR_PATH, dirName, stickerId + ".webp")
  );

  if (originalExtension) {
    paths.push(
      join(env.ASSETS_DIR_PATH, "original", `${stickerId}.${originalExtension}`)
    );
  }

  return paths;
}
