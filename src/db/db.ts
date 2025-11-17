import SQLite from "better-sqlite3";
import { mkdir } from "fs/promises";
import { join } from "path";
import { env } from "../env.js";
import { Constants } from "../utils/index.js";
import { migrateToLatest } from "./migrate.js";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import type { Database } from "../types/db.js";

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
