import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";
import type { StickerVariant } from "./stickers.js";

export type UserPermissionsTable = {
  id: ColumnType<string, string, never>;
  username: string;
  addSticker: Generated<number>;
  editSticker: Generated<number>;
  deleteSticker: Generated<number>;
  addUser: Generated<number>;
  editUser: Generated<number>;
  deleteUser: Generated<number>;
};

export type StickerTable = {
  rowid: ColumnType<number, never, never>;
  id: ColumnType<string, string, never>;
  title: string;
  description: string | null;
  usageCount: ColumnType<number, number | undefined, number>;
  sourceUrl: ColumnType<string | null, string | null, never>;
  uploaderId: ColumnType<string, string, never>;
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
  count: Generated<number>;
  timeLastUsed: number;
};

export type StickerFTSTable = {
  rowid: ColumnType<number, never, never>;
  title: ColumnType<Sticker["title"], never, never>;
  tags: ColumnType<Sticker["tags"], never, never>;
};

export type Database = {
  userPermissions: UserPermissionsTable;
  sticker: StickerTable;
  variant: VariantTable;
  usage: UsageTable;
  stickerFts: StickerFTSTable;
};

export type UserPermissions = Selectable<UserPermissionsTable>;
export type NewUserPermissions = Insertable<UserPermissionsTable>;
export type UserPermissionsUpdate = Updateable<UserPermissionsTable>;
export type Permissions = Omit<UserPermissions, "id" | "username">;

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
