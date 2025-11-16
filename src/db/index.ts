import SQLite from "better-sqlite3";
import { env } from "../env.js";
import { CamelCasePlugin, Kysely, sql, SqliteDialect } from "kysely";
import type {
  Database,
  NewSticker,
  NewUserPermissions,
  NewVariant,
  StickerUpdate,
  UserPermissions,
  UserPermissionsUpdate,
} from "../types/db.js";
import { migrateToLatest } from "./migrate.js";
import { join } from "path";
import {
  Cache,
  Constants,
  deleteVariants,
  treatString,
} from "../utils/index.js";
import { mkdir } from "fs/promises";
import type { SimplifiedSticker } from "../types/stickers.js";

const stickerCache = new Cache<string, SimplifiedSticker>(
  Constants.STICKER_CACHE_EXPIRATION_MS
);
const searchCache = new Cache<string, { name: string; value: string }[]>(
  Constants.SEARCH_CACHE_EXPIRATION_MS
);
const userPermissionsCache = new Cache<string, UserPermissions>(
  Constants.USER_PERMISSIONS_CACHE_EXPIRATION_MS
);

function createDbDir() {
  const promises = [];
  const mkdirOptions = {
    recursive: true,
  };

  promises.push(
    mkdir(join(env.ASSETS_DIR_PATH, Constants.TEMP_DIR_NAME), mkdirOptions),
    mkdir(
      join(env.ASSETS_DIR_PATH, Constants.ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME),
      mkdirOptions
    ),
    mkdir(env.DB_DIR_PATH, mkdirOptions)
  );
  promises.push(
    Object.values(Constants.VariantEncodingMap).map(({ dirName }) =>
      mkdir(join(env.ASSETS_DIR_PATH, dirName), mkdirOptions)
    )
  );

  return Promise.all(promises);
}

function createDb() {
  const db = new SQLite(join(env.DB_DIR_PATH, "stickbot.db"), {
    fileMustExist: false,
    // verbose: (...args: any[]) => console.dir(...args, { depth: null }),
  });
  db.pragma("journal_mode = WAL");
  return db;
}

export const db = await (async () => {
  await createDbDir();
  await migrateToLatest(createDb());

  const db = createDb();

  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: db }),
    plugins: [new CamelCasePlugin()],
    log: env.VERBOSE_LOGGING
      ? (event) => {
          console.dir(event.query, { depth: null });
        }
      : () => {},
  });
})();

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
      .returningAll()
      .executeTakeFirstOrThrow();

    stickerCache.set(sticker.id, {
      id: sticker.id,
      title: sticker.title,
      tags: sticker.tags,
    });
    searchCache.clear();

    await trx.insertInto("variant").values(variants).execute();
  });
}

export async function search(query: string) {
  if (!query) return [];

  query = treatString(query)
    .split(" ")
    .map((token) => (token ? token + "*" : ""))
    .join(" ");

  let results = searchCache.get(query);
  if (results) return results;

  results = await db
    .selectFrom("sticker")
    .innerJoin("stickerFts", "sticker.rowid", "stickerFts.rowid")
    .select(["sticker.id as value", "sticker.title as name"])
    .where(() => sql`sticker_fts MATCH ${query}`)
    .orderBy(sql`bm25(sticker_fts)`) // optional but recommended ranking
    .limit(25)
    .execute();
  searchCache.set(query, results);
  return results;
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
        .returning(["id", "title", "tags"])
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
        .select(["id", "title", "tags"])
        .where("id", "=", id)
        .executeTakeFirst();
    }

    if (!sticker) return; // Don't update cache unless sticker is found

    stickerCache.set(id, {
      id: sticker.id,
      title: sticker.title,
      tags: sticker.tags,
    });
  });

  return sticker;
}

export async function updateSticker(id: string, sticker: StickerUpdate) {
  await db
    .updateTable("sticker")
    .set({
      title: sticker.title ? treatString(sticker.title) : undefined,
      tags: sticker.tags ? treatString(sticker.tags) : undefined,
      description: sticker.description,
    })
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

  searchCache.clear();

  // Need to SELECT after updating because RETURNING doesn't work with FTS5...
  await getStickerById(id);
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

    stickerCache.delete(id);
    searchCache.clear();
    return true;
  });
}
