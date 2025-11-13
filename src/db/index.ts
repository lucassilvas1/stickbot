import SQLite from "better-sqlite3";
import { env } from "../env.js";
import { CamelCasePlugin, Kysely, SqliteDialect, Transaction } from "kysely";
import type { Database, NewSticker, NewVariant } from "../types/db.js";
import { mkdirSync } from "fs";
import { migrateToLatest } from "./migrate.js";
import { join } from "path";
import { Constants, treatString } from "../utils/index.js";

function createDbDir() {
  mkdirSync(
    join(env.ASSETS_DIR_PATH, Constants.ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME),
    { recursive: true }
  );
  Object.values(Constants.VariantEncodingMap).forEach(({ dirName }) => {
    mkdirSync(join(env.ASSETS_DIR_PATH, dirName), { recursive: true });
  });
  mkdirSync(env.DB_DIR_PATH, {
    recursive: true,
  });
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
  createDbDir();
  await migrateToLatest(createDb());

  const db = createDb();

  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: db }),
    plugins: [new CamelCasePlugin()],
    // log: (event) => {
    //   console.dir(event.query, { depth: null });
    // },
  });
})();

export function insertSticker(
  sticker: Omit<NewSticker, "timeAdded" | "timeModified">,
  variants: NewVariant[]
) {
  return db.transaction().execute(async (trx) => {
    const now = Date.now();

    await trx
      .insertInto("sticker")
      .values({
        ...sticker,
        title: treatString(sticker.title),
        tags: treatString(sticker.tags),
        timeAdded: now,
        timeModified: now,
      })
      .execute();

    await trx.insertInto("variant").values(variants).execute();
  });
}
