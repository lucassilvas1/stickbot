import type {
  Database,
  NewStickerWithoutTimestamps,
  NewUserPermissions,
  NewVariant,
  StickerUpdate,
  UserPermissionsUpdate,
} from "../types/db.js";
import { sanitizeString } from "../utils/misc.js";
import { simplifiedStickerColumns } from "../types/stickers.js";
import {
  onStickerUpdated,
  stickerCache,
  userPermissionsCache,
} from "./cache.js";
import type { Kysely, Transaction } from "kysely";
import { deleteAllVariants } from "../utils/processing.js";
import { logger } from "../logger.js";

export async function _insertUserPermissions(
  db: Kysely<Database>,
  newUserPermissions: NewUserPermissions
) {
  const userPermissions = await db
    .insertInto("userPermissions")
    .values(newUserPermissions)
    .returningAll()
    .onConflict((oc) => oc.doNothing())
    .executeTakeFirst();
  if (!userPermissions) return false;
  userPermissionsCache.set(userPermissions.id, userPermissions);
  return true;
}

export async function _getUserPermissionsById(
  db: Kysely<Database>,
  id: string
) {
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

export async function _updateUserPermissions(
  db: Kysely<Database>,
  id: string,
  userPermissions: UserPermissionsUpdate
) {
  const updatedUserPermissions = await db
    .updateTable("userPermissions")
    .set(userPermissions)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  if (updatedUserPermissions) {
    userPermissionsCache.set(id, updatedUserPermissions);
  }
  return updatedUserPermissions;
}

export async function _deleteUserPermissions(db: Kysely<Database>, id: string) {
  const result = await db
    .deleteFrom("userPermissions")
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (result) userPermissionsCache.delete(id);
  return result;
}

export async function _getUsers(
  db: Kysely<Database>,
  offset: number,
  limit: number
) {
  const countResult = await db
    .selectFrom("userPermissions")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();
  const count = Number(countResult.count);

  const users = await db
    .selectFrom("userPermissions")
    .selectAll()
    .orderBy("username", "asc")
    .offset(offset)
    .limit(limit)
    .execute();

  for (const user of users) {
    userPermissionsCache.set(user.id, user);
  }

  return {
    users: users,
    isLastPage: offset + limit >= count,
    totalResultCount: count,
  };
}

export function _insertSticker(
  db: Kysely<Database>,
  newSticker: NewStickerWithoutTimestamps,
  variants: NewVariant[]
) {
  return db.transaction().execute(async (trx) => {
    const now = Date.now();

    const sticker = await trx
      .insertInto("sticker")
      .values({
        ...newSticker,
        title: sanitizeString(newSticker.title),
        tags: sanitizeString(newSticker.tags),
        timeAdded: now,
        timeModified: now,
        timeLastUsed: now,
        usageCount: 1,
      })
      .returning(simplifiedStickerColumns)
      .executeTakeFirstOrThrow();

    _incrementStickerUsage(
      db,
      sticker.id,
      sticker.uploaderId,
      undefined,
      false
    );
    onStickerUpdated(newSticker.id, true, { sticker });

    await trx.insertInto("variant").values(variants).execute();
  });
}

export async function _incrementStickerUsage(
  db: Kysely<Database>,
  stickerId: string,
  userId: string,
  transaction?: Transaction<Database>,
  incrementGlobal = true
) {
  const now = Date.now();

  const run = async (trx: Transaction<Database>) => {
    let sticker;
    if (incrementGlobal) {
      sticker = await trx
        .updateTable("sticker")
        .set((eb) => ({
          usageCount: eb("usageCount", "+", 1),
          timeLastUsed: now,
        }))
        .where("id", "=", stickerId)
        .returning(simplifiedStickerColumns)
        .executeTakeFirst();
    }
    await trx
      .insertInto("usage")
      .values({ userId, stickerId, count: 1, timeLastUsed: now })
      .onConflict((oc) =>
        oc.columns(["userId", "stickerId"]).doUpdateSet((eb) => ({
          count: eb("count", "+", 1),
          timeLastUsed: now,
        }))
      )
      .execute();

    onStickerUpdated(stickerId, false, { sticker, userId });

    return sticker;
  };

  if (transaction) {
    return run(transaction);
  }
  return db.transaction().execute(run);
}

export async function _getStickerById(
  db: Kysely<Database>,
  id: string,
  incrementUsage?: boolean,
  userId?: string
) {
  let sticker = stickerCache.get(id);

  try {
    await db.transaction().execute(async (trx) => {
      if (incrementUsage && userId) {
        sticker = await _incrementStickerUsage(db, id, userId, trx);
      } else if (!sticker) {
        sticker = await trx
          .selectFrom("sticker")
          .select(simplifiedStickerColumns)
          .where("id", "=", id)
          .executeTakeFirst();
        onStickerUpdated(id, false, { sticker });
      }
    });
  } catch (err) {
    const error = err as any;
    // _incrementStickerUsage will throw this if a sticker with `id` is not
    // in the db when it tries to update the "usage" table
    if (error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return;
    }
    logger.error({ error, id, userId }, "could not get sticker by ID");
    throw err;
  }
  return sticker;
}

export function _getStickerByTitle(db: Kysely<Database>, title: string) {
  return db
    .selectFrom("sticker")
    .where("title", "=", sanitizeString(title))
    .select(simplifiedStickerColumns)
    .executeTakeFirst();
}

export async function _updateSticker(
  db: Kysely<Database>,
  id: string,
  sticker: StickerUpdate
) {
  const updatedSticker = await db
    .updateTable("sticker")
    .set({
      title: sticker.title ? sanitizeString(sticker.title) : undefined,
      tags: sticker.tags ? sanitizeString(sticker.tags) : undefined,
      description: sticker.description,
      timeModified: Date.now(),
    })
    .where("id", "=", id)
    .returning(simplifiedStickerColumns)
    .executeTakeFirstOrThrow();

  onStickerUpdated(id, true, { sticker: updatedSticker });
}

export async function _deleteSticker(db: Kysely<Database>, id: string) {
  return db.transaction().execute(async (trx) => {
    const variants = await trx
      .selectFrom("variant")
      .selectAll()
      .where("stickerId", "=", id)
      .execute();

    await deleteAllVariants(id, variants);

    const result = await trx
      .deleteFrom("sticker")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result.numDeletedRows) return false;

    onStickerUpdated(id, true);
    return true;
  });
}
