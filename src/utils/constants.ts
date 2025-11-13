import type {
  StickerVariant,
  StickerVariantEncodingConfig,
} from "../types/stickers.js";

export const DEFAULT_COMMAND_COOLDOWN_MS = 2_000;
export const MAX_VIDEO_DURATION_SECONDS = 10;
export const MAX_ATTACHMENT_SIZE_MB = 20;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

export const MEDIA_HEADERS_TIMEOUT_MS = 10_000;
export const MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;

export const ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME = "original";
export const STICKER_ID_LENGTH = 12;

export const VariantEncodingMap: Record<
  Exclude<StickerVariant, "original">,
  StickerVariantEncodingConfig
> = {
  high: {
    name: "high",
    dirName: "high",
    height: 512,
    frameRate: 30,
    maxBitrate: "500k",
    bufSize: "1000k",
    method: 5,
    quality: 90,
  } as const,
  thumbnail: {
    name: "thumbnail",
    dirName: "thumb",
    height: 128,
    frameRate: 15,
    maxBitrate: "200k",
    bufSize: "400k",
    method: 5,
    quality: 75,
  } as const,
} as const;
