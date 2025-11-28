import { createWriteStream, renameSync, rmSync } from "fs";
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
import { join } from "path";

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

export function deleteVariants(
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
  return Promise.all(promises);
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
  args.push("-y", tempPath);

  try {
    await spawn(env.FFMPEG_PATH, args);
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
