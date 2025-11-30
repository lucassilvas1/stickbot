import SQLite from "better-sqlite3";
import { copyFile, mkdir } from "fs/promises";
import { join } from "path";
import { env } from "../env.js";
import { migrateToLatest } from "./migrate.js";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import type { Database } from "../types/db.js";
import { readdirSync } from "fs";
import {
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  VariantEncodingMap,
} from "../utils/constants.js";

function moveStaticFiles(assetsDirPath: string) {
  const originalPath = join(import.meta.dirname, "../../assets");
  const names = readdirSync(originalPath);
  const promises = Promise.all(
    names.map((name) =>
      copyFile(join(originalPath, name), join(assetsDirPath, name))
    )
  );
  return promises;
}

function createDirs(dbDirPath: string, assetsDirPath: string) {
  const promises: Promise<unknown>[] = [];
  const mkdirOptions = {
    recursive: true,
  };

  promises.push(
    mkdir(join(assetsDirPath, ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME), mkdirOptions),
    mkdir(dbDirPath, mkdirOptions)
  );
  promises.push(
    ...Object.values(VariantEncodingMap).map(({ dirName }) =>
      mkdir(join(assetsDirPath, dirName), mkdirOptions)
    )
  );

  return Promise.all(promises);
}

function createDb(dbPath: string) {
  const db = new SQLite(dbPath, {
    fileMustExist: false,
    // verbose: (...args: any[]) => console.dir(...args, { depth: null }),
  });
  db.pragma("journal_mode = WAL");
  return db;
}

type DBInitOptions = {
  dbDirPath?: string;
  assetsDirPath?: string;
};

export async function initDb({
  dbDirPath = env.DB_DIR_PATH,
  assetsDirPath = env.ASSETS_DIR_PATH,
}: DBInitOptions = {}) {
  if (
    process.env.NODE_ENV === "test" &&
    (!env.DB_DIR_PATH.includes("test") || !env.ASSETS_DIR_PATH.includes("test"))
  ) {
    throw new Error("Test environment using non-test paths!");
  }

  await createDirs(dbDirPath, assetsDirPath);
  await moveStaticFiles(assetsDirPath);
  const sqlite = createDb(join(dbDirPath, "stickbot.db"));
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
