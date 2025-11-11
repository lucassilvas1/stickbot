import SQLite from "better-sqlite3";
import path from "path";
import { env } from "../env.js";
import { Kysely, SqliteDialect } from "kysely";
import type { Database } from "../types/db.js";
import { mkdirSync } from "fs";
import { migrateToLatest } from "./migrate.js";

function createDbDir() {
  mkdirSync(env.DB_DIR_PATH, { recursive: true });
  mkdirSync(env.ASSETS_DIR_PATH, { recursive: true });
}

function createDb() {
  const db = new SQLite(path.join(env.DB_DIR_PATH, "stickbot.db"), {
    fileMustExist: false,
    // verbose: (...args: any[]) => console.dir(...args, { depth: null }),
  });
  db.pragma("journal_mode = WAL");
  return db;
}

export async function getDb() {
  createDbDir();
  await migrateToLatest(createDb());

  const db = createDb();

  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: db }),
    // log: (event) => {
    //   console.dir(event.query, { depth: null });
    // },
  });
}
