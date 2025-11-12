import { createWriteStream, renameSync, rmSync, statSync } from "fs";
import { env } from "../env.js";
import type {
  StickerVariant,
  StickerVariantEncodingConfig,
} from "../types/stickers.js";
import { Constants } from "./index.js";
import { spawn } from "child_process";
import type { Dispatcher } from "undici";
import { extname } from "path";
import type { NewVariant } from "../types/db.js";
import { TypedError } from "./misc.js";

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

export function processFile(
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

  const ffmpeg = spawn(env.FFMPEG_PATH, args);

  return new Promise((resolve, reject) => {
    let stderrOutput = "";

    // Capture stderr for debugging
    ffmpeg.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    // Handle process close
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        rmSync(tempPath, { force: true });
        reject(new Error(`FFmpeg failed with code ${code}: ${stderrOutput}`));
      } else {
        renameSync(tempPath, outputPath);
        resolve();
      }
    });

    // Handle errors
    ffmpeg.on("error", (error) => {
      rmSync(tempPath, { force: true });
      reject(new Error(`Failed to spawn FFmpeg: ${error.message}`));
    });

    ffmpeg.stdin.on("error", (error) => {
      rmSync(tempPath, { force: true });
      reject(new Error(`stdin error: ${error.message}`));
    });
  });
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
