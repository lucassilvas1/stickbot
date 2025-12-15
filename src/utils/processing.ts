import { createWriteStream, renameSync, rmSync, statSync } from "fs";
import type { Dispatcher } from "undici";
import type {
  StickerVariant,
  StickerVariantEncodingConfig,
} from "../types/stickers.js";
import { spawn, TypedError } from "./misc.js";
import { env } from "../env.js";
import sharp from "sharp";
import { MAX_VIDEO_DURATION_SECONDS, VariantEncodingMap } from "./constants.js";
import { rm } from "fs/promises";
import { extname, join } from "path";
import type { NewVariant } from "../types/db.js";

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

export async function getVariantInfo(
  stickerId: string,
  type: StickerVariant,
  filePath: string
): Promise<NewVariant> {
  // Get file size using fs.statSync
  let fileSizeBytes: number;
  try {
    fileSizeBytes = statSync(filePath).size;
  } catch (error) {
    throw new TypedError("FFPROBE_ERROR", { cause: error });
  }

  // Get extension
  const extension = extname(filePath).substring(1); // Remove leading dot

  // Use ffprobe to get video/image dimensions and frame count
  try {
    const output = await spawn(env.FFPROBE_PATH, [
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
      throw new TypedError("FFPROBE_ERROR", {
        message: "Could not extract width and height from media file",
      });
    } else {
      return {
        stickerId,
        type,
        width,
        height,
        fileSizeBytes,
        extension,
        animated: ~~(frameCount !== undefined && frameCount > 1),
      };
    }
  } catch (error) {
    if (error instanceof TypedError) throw error;
    throw new TypedError("FFPROBE_ERROR", {
      cause: error,
    });
  }
}

export async function deleteAllVariants(
  id: string,
  variants: { type: StickerVariant; extension: string }[]
) {
  const promises = Object.values(VariantEncodingMap).map(({ dirName }) =>
    rm(join(env.ASSETS_DIR_PATH, dirName, id + ".webp"), { force: true })
  );
  const original = variants.find((variant) => variant.type === "original");
  promises.push(
    rm(join(env.ASSETS_DIR_PATH, "original", `${id}.${original?.extension}`), {
      force: true,
    })
  );
  await Promise.all(promises);
}

export function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  options: StickerVariantEncodingConfig
) {
  // Build ffmpeg arguments
  const args = ["-i", inputPath];

  // Build scale filter to ensure height doesn't exceed the parameter, and resample fps if needed
  let filterChain = `scale='iw':'min(${options.height}\\,ih)':force_original_aspect_ratio=decrease`;
  if (options.frameRate) {
    filterChain += `,fps='min(${options.frameRate}\\,source_fps)'`;
  }
  args.push("-vf", filterChain);

  args.push("-t", String(MAX_VIDEO_DURATION_SECONDS)); // Trim to max duration
  args.push("-c:v", "libwebp_anim"); // Use libwebp codec
  args.push("-loop", "0"); // Infinite loop for animated webp

  if (options.quality) args.push("-quality", String(options.quality));
  if (options.method) args.push("-method", String(options.method));
  if (options.maxBitrate) args.push("-maxrate", options.maxBitrate);
  if (options.bufSize) args.push("-bufsize", options.bufSize);

  args.push("-an"); // Disable audio

  args.push("-pix_fmt", "bgra"); // Force BGRA for transparency support
  args.push("-f", "webp"); // Specify output format
  args.push("-y", outputPath);

  return args;
}

export async function ffmpeg(
  inputPath: string,
  outputPath: string,
  options: StickerVariantEncodingConfig
): Promise<void> {
  const tempPath = outputPath + ".part";
  const args = buildFfmpegArgs(inputPath, tempPath, options);

  try {
    await spawn(env.FFMPEG_PATH, args);
    renameSync(tempPath, outputPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw new TypedError("FFMPEG_ERROR", { cause: error });
  }
}

export async function processWebp(
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
