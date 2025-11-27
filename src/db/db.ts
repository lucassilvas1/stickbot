import SQLite from "better-sqlite3";
import { copyFile, mkdir } from "fs/promises";
import { join } from "path";
import { env } from "../env.js";
import { Constants } from "../utils/index.js";
import { migrateToLatest } from "./migrate.js";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import type { Database } from "../types/db.js";
import { readdirSync } from "fs";

function moveStaticFiles() {
  const originalPath = join(import.meta.dirname, "../../assets");
  const names = readdirSync(originalPath);
  const promises = Promise.all(
    names.map((name) =>
      copyFile(join(originalPath, name), join(env.ASSETS_DIR_PATH, name))
    )
  );
  return promises;
}

function createDirs() {
  const promises: Promise<unknown>[] = [];
  const mkdirOptions = {
    recursive: true,
  };

  promises.push(
    mkdir(
      join(env.ASSETS_DIR_PATH, Constants.ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME),
      mkdirOptions
    ),
    mkdir(env.DB_DIR_PATH, mkdirOptions)
  );
  promises.push(
    ...Object.values(Constants.VariantEncodingMap).map(({ dirName }) =>
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

export async function initDb() {
  await createDirs();
  await moveStaticFiles();
  const sqlite = createDb();
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
    log: env.VERBOSE_LOGGING
      ? (event) => {
          console.dir(event.query, { depth: null });
        }
      : () => {},
  });

  await migrateToLatest(db);

  return db;
}

export const db = await initDb();
