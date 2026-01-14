import SQLite from "better-sqlite3";
import { join } from "path";
import { promises as fs } from "fs";
import { env } from "../env.js";
import { migrateToLatest } from "./migrate.js";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import type { Database } from "../types/db.js";
import { logger } from "../logging/logger.js";
import {
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  VariantEncodingMap,
} from "../utils/constants.js";

async function moveStaticFiles(assetsDirPath: string) {
  const originalPath = join(import.meta.dirname, "../../assets");
  const names = await fs.readdir(originalPath);
  const promises = Promise.all(
    names.map((name) =>
      fs.copyFile(join(originalPath, name), join(assetsDirPath, name))
    )
  );
  return promises;
}

function createDirs(dbDirPath: string, assetsDirPath: string) {
  const promises: Promise<unknown>[] = [];
  const mkdirOptions = {
    recursive: true,
  };
  // Create db original media directory
  promises.push(
    fs.mkdir(
      join(assetsDirPath, ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME),
      mkdirOptions
    ),
    fs.mkdir(dbDirPath, mkdirOptions)
  );
  // Create variant directories
  promises.push(
    ...Object.values(VariantEncodingMap).map(({ dirName }) =>
      fs.mkdir(join(assetsDirPath, dirName), mkdirOptions)
    )
  );

  return Promise.all(promises);
}

function createDb(dbPath: string) {
  const db = new SQLite(dbPath, {
    fileMustExist: false,
    verbose: (...args: any[]) => logger.debug([...args], "creating db"),
  });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function initDb({
  dbDirPath = env.DB_DIR_PATH,
  assetsDirPath = env.ASSETS_DIR_PATH,
} = {}) {
  if (
    process.env.NODE_ENV === "test" &&
    (!dbDirPath.includes("test") || !assetsDirPath.includes("test"))
  ) {
    throw new Error("Test environment using non-test paths!");
  }

  await createDirs(dbDirPath, assetsDirPath);
  await moveStaticFiles(assetsDirPath);

  const sqlite = createDb(join(dbDirPath, "stickbot.db"));
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
    log: (event) => void logger.debug({ event }),
  });

  await migrateToLatest(db);

  return db;
}
