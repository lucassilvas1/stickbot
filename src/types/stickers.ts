import type { Sticker } from "./db.js";

export type SimplifiedSticker = Pick<Sticker, "id" | "title" | "tags">;

export type StickerVariant = "original" | "high" | "thumbnail";

export type StickerVariantEncodingConfig = {
  name: string;
  dirName: string;
  height: number;
  frameRate?: number;
  maxBitrate?: string;
  bufSize?: string;
  method: 1 | 2 | 3 | 4 | 5 | 6;
  quality: number;
};
