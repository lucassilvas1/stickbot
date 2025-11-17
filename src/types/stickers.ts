import type { Sticker } from "./db.js";

export type SimplifiedSticker = Pick<
  Sticker,
  "id" | "title" | "tags" | "usageCount" | "timeLastUsed"
>;
export const simplifiedStickerColumns: Readonly<(keyof SimplifiedSticker)[]> = [
  "id",
  "title",
  "tags",
  "usageCount",
  "timeLastUsed",
];

export type StickerSearchOrder = "usage.timeLastUsed" | "usage.count";

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
