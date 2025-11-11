import type { ColumnType, Insertable, Selectable, Updateable } from "kysely";
import type { AnimatedImageExt, ImageExt, StickerVariant } from "./stickers.js";

export type StickerTable = {
  id: ColumnType<string, string, never>;
  title: string;
  description: string | null;
  format: ColumnType<string, string, never>;
  width: ColumnType<number, number, never>;
  height: ColumnType<number, number, never>;
  file_size_bytes: ColumnType<number, number, never>;
  animated: ColumnType<number, number, never>;
  usage_count: ColumnType<number, number | undefined, number>;
  source_url: ColumnType<string | null, string | null, never>;
  checksum: string;
  uploader_id: ColumnType<string | null, string | null, never>;
  time_added: ColumnType<number, number, never>;
  time_modified: number;
  time_last_used: number | null;
  tag_string: string;
};

export type TagTable = {
  sticker_id: ColumnType<string, string, never>;
  tag: ColumnType<string, string, never>;
};

export type VariantTable = {
  sticker_id: ColumnType<string, string, never>;
  type: StickerVariant;
  format: ImageExt | AnimatedImageExt;
  width: number;
  height: number;
  file_size_bytes: number;
};

export type UsageTable = {
  sticker_id: ColumnType<string, string, never>;
  user_id: ColumnType<string, string, never>;
  count: ColumnType<number, number | undefined, number>;
  time_last_used: number;
};

export type Database = {
  sticker: StickerTable;
  tag: TagTable;
  variant: VariantTable;
  usage: UsageTable;
};

export type Sticker = Selectable<StickerTable>;
export type NewSticker = Insertable<StickerTable>;
export type StickerUpdate = Updateable<StickerTable>;

export type Tag = Selectable<TagTable>;
export type NewTag = Insertable<TagTable>;

export type Variant = Selectable<VariantTable>;
export type NewVariant = Insertable<VariantTable>;
export type VariantUpdate = Updateable<VariantTable>;

export type Usage = Selectable<UsageTable>;
export type NewUsage = Insertable<UsageTable>;
export type UsageUpdate = Updateable<UsageTable>;
