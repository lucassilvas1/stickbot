import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";
import type { StickerVariant } from "./stickers.js";

export type UserTable = {
  id: ColumnType<string, string, never>;
  username: string;
  canAddSticker: Generated<number>;
  canEditSticker: Generated<number>;
  canDeleteSticker: Generated<number>;
  canAddUser: Generated<number>;
  canDeleteUser: Generated<number>;
};

export type StickerTable = {
  rowid: ColumnType<number, never, never>;
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

export type StickerFTSTable = {
  rowid: ColumnType<number, never, never>;
  title: ColumnType<Sticker["title"], never, never>;
  tags: ColumnType<Sticker["tags"], never, never>;
};

export type Database = {
  user: UserTable;
  sticker: StickerTable;
  variant: VariantTable;
  usage: UsageTable;
  stickerFts: StickerFTSTable;
};

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type Sticker = Selectable<StickerTable>;
export type NewSticker = Insertable<StickerTable>;
export type StickerUpdate = Updateable<StickerTable>;

export type Variant = Selectable<VariantTable>;
export type NewVariant = Insertable<VariantTable>;
export type VariantUpdate = Updateable<VariantTable>;

export type Usage = Selectable<UsageTable>;
export type NewUsage = Insertable<UsageTable>;
export type UsageUpdate = Updateable<UsageTable>;

export type StickerFTS = Selectable<StickerFTSTable>;
