import type { Permissions } from "../types/db.js";
import type {
  StickerVariant,
  StickerVariantEncodingConfig,
} from "../types/stickers.js";

export const TEST_DIR_PATH = "./test-data/";

export const DEFAULT_COMMAND_COOLDOWN_MS = 2_000;
export const MAX_VIDEO_DURATION_SECONDS = 10;
export const MAX_ATTACHMENT_SIZE_MB = 20;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

export const MEDIA_HEADERS_TIMEOUT_MS = 10_000;
export const MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;

export const ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME = "original";
export const STICKER_ID_LENGTH = 12;

export const STICKER_CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SEARCH_CACHE_EXPIRATION_MS = 2 * 24 * 60 * 60 * 1000;
export const USER_PERMISSIONS_CACHE_EXPIRATION_MS = 2147483647;

export const MIN_TITLE_LENGTH = 8;
export const MAX_TITLE_LENGTH = 64;
export const MIN_TAGS_LENGTH = 10;
export const MAX_TAGS_LENGTH = 256;
export const MAX_DESCRIPTION_LENGTH = 512;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 24;

export const GRID_PLACEHOLDER_IMG_PATH = "placeholder.png";

export const PERMISSION_PUNT_MESSAGE =
  "You do not have the permissions necessary to run this command";
export const NOT_ENOUGH_CLEARANCE_PUNT_MESSAGE =
  "You do not have enough clearance to grant these permissions";
export const GENERIC_ERROR_MESSAGE =
  "An error occurred while processing your request.";

export const SUPPORTED_CONTAINERS = [
  "jpg",
  "jpeg",
  "png",
  "bmp",
  "webp",
  "tiff",
  "tif",
  "gif",
  "heic",
  "heif",
  "jp2",
  "j2k",
  "tga",
  "pcx",
  "pnm",
  "ppm",
  "pgm",
  "pbm",
  "dds",
  "exr",
  "psd",
  "ico",
  "avif",
  "apng",
  "mng",
  "webp",
  "flif",
  "mp4",
  "mkv",
  "mov",
  "avi",
  "webm",
  "flv",
  "wmv",
  "mpg",
  "mpeg",
  "vob",
  "ts",
  "m2ts",
  "3gp",
  "ogv",
  "ogg",
  "asf",
  "mxf",
];

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
    height: 256,
    frameRate: 15,
    maxBitrate: "250k",
    bufSize: "500k",
    method: 5,
    quality: 75,
  } as const,
} as const;
