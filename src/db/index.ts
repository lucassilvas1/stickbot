import type {
  NewSticker,
  NewUserPermissions,
  NewVariant,
  StickerUpdate,
  UserPermissionsUpdate,
} from "../types/db.js";
import { deleteVariants, treatString } from "../utils/index.js";
import {
  simplifiedStickerColumns,
  type SimplifiedSticker,
} from "../types/stickers.js";
import { db } from "./db.js";
import {
  onStickerUpdated,
  stickerCache,
  userPermissionsCache,
} from "./cache.js";
export * from "./search.js";

export async function insertUserPermissions(
  NewUserPermissions: NewUserPermissions
) {
  const userPermissions = await db
    .insertInto("userPermissions")
    .values(NewUserPermissions)
    .returningAll()
    .onConflict((oc) => oc.doNothing())
    .executeTakeFirst();
  if (!userPermissions) return false;
  userPermissionsCache.set(userPermissions.id, userPermissions);
  return true;
}

export async function getUserPermissionsById(id: string) {
  const cachedUser = userPermissionsCache.get(id);
  if (cachedUser) return cachedUser;

  const userPermissions = await db
    .selectFrom("userPermissions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (userPermissions) userPermissionsCache.set(id, userPermissions);
  return userPermissions;
}

export async function updateUserPermissions(
  id: string,
  userPermissions: UserPermissionsUpdate
) {
  const updatedUserPermissions = await db
    .updateTable("userPermissions")
    .set(userPermissions)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  if (updatedUserPermissions)
    userPermissionsCache.set(id, updatedUserPermissions);
  return !!updatedUserPermissions;
}

export async function deleteUserPermissions(id: string) {
  const result = await db
    .deleteFrom("userPermissions")
    .where("id", "=", id)
    .executeTakeFirst();
  if (result.numDeletedRows) userPermissionsCache.delete(id);
  return !!result.numDeletedRows;
}

export function insertSticker(
  newSticker: Omit<NewSticker, "timeAdded" | "timeModified">,
  variants: NewVariant[]
) {
  return db.transaction().execute(async (trx) => {
    const now = Date.now();

    const sticker = await trx
      .insertInto("sticker")
      .values({
        ...newSticker,
        title: treatString(newSticker.title),
        tags: treatString(newSticker.tags),
        timeAdded: now,
        timeModified: now,
      })
      .returning(simplifiedStickerColumns)
      .executeTakeFirstOrThrow();

    onStickerUpdated(newSticker.id, sticker);

    await trx.insertInto("variant").values(variants).execute();
  });
}

export async function getStickerById(
  id: string
): Promise<SimplifiedSticker | undefined>;
export async function getStickerById(
  id: string,
  incrementUsage: true,
  userId: string
): Promise<SimplifiedSticker | undefined>;
export async function getStickerById(
  id: string,
  incrementUsage?: boolean,
  userId?: string
) {
  let sticker = stickerCache.get(id);

  await db.transaction().execute(async (trx) => {
    if (incrementUsage && userId) {
      const now = Date.now();

      sticker = await trx
        .updateTable("sticker")
        .set((eb) => ({
          usageCount: eb("usageCount", "+", 1),
          timeLastUsed: now,
        }))
        .where("id", "=", id)
        .returning(simplifiedStickerColumns)
        .executeTakeFirst();
      await trx
        .insertInto("usage")
        .values({ userId, stickerId: id, count: 1, timeLastUsed: now })
        .onConflict((oc) =>
          oc.columns(["userId", "stickerId"]).doUpdateSet((eb) => ({
            count: eb("count", "+", 1),
            timeLastUsed: now,
          }))
        )
        .execute();
    } else if (!sticker) {
      sticker = await trx
        .selectFrom("sticker")
        .select(simplifiedStickerColumns)
        .where("id", "=", id)
        .executeTakeFirst();
    }

    if (!sticker) return; // Don't update cache unless sticker is found

    onStickerUpdated(id, sticker);
  });

  return sticker;
}

export async function updateSticker(id: string, sticker: StickerUpdate) {
  const updatedSticker = await db
    .updateTable("sticker")
    .set({
      title: sticker.title ? treatString(sticker.title) : undefined,
      tags: sticker.tags ? treatString(sticker.tags) : undefined,
      description: sticker.description,
      timeModified: Date.now(),
    })
    .where("id", "=", id)
    .returning(simplifiedStickerColumns)
    .executeTakeFirstOrThrow();

  onStickerUpdated(id, updatedSticker);
}

export async function deleteSticker(id: string) {
  return db.transaction().execute(async (trx) => {
    const variants = await trx
      .selectFrom("variant")
      .selectAll()
      .where("stickerId", "=", id)
      .execute();

    await deleteVariants(id, variants);

    const result = await trx
      .deleteFrom("sticker")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result.numDeletedRows) return false;

    onStickerUpdated(id);
    return true;
  });
}
