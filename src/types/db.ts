import type { ColumnType, Insertable, Selectable, Updateable } from "kysely";
import type { StickerVariant } from "./stickers.js";

export type StickerTable = {
  id: ColumnType<string, string, never>;
  title: string;
  description: string | null;
  usageCount: ColumnType<number, number | undefined, number>;
  sourceUrl: ColumnType<string | null, string | null, never>;
  uploaderId: ColumnType<string | null, string | null, never>;
  timeAdded: ColumnType<number, number, never>;
  timeModified: number;
  timeLastUsed: number | null;
  tags: string;
};

export type VariantTable = {
  stickerId: ColumnType<string, string, never>;
  type: StickerVariant;
  extension: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  animated: number;
};

export type UsageTable = {
  stickerId: ColumnType<string, string, never>;
  userId: ColumnType<string, string, never>;
  count: ColumnType<number, number | undefined, number>;
  timeLastUsed: number;
};

export type Database = {
  sticker: StickerTable;
  variant: VariantTable;
  usage: UsageTable;
};

export type Sticker = Selectable<StickerTable>;
export type NewSticker = Insertable<StickerTable>;
export type StickerUpdate = Updateable<StickerTable>;

export type Variant = Selectable<VariantTable>;
export type NewVariant = Insertable<VariantTable>;
export type VariantUpdate = Updateable<VariantTable>;

export type Usage = Selectable<UsageTable>;
export type NewUsage = Insertable<UsageTable>;
export type UsageUpdate = Updateable<UsageTable>;
