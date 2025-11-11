import * as path from "path";
import { promises as fs } from "fs";
import { Kysely, Migrator, FileMigrationProvider, SqliteDialect } from "kysely";
import type { Database } from "better-sqlite3";

export async function migrateToLatest(database: Database) {
  const db = new Kysely<any>({
    dialect: new SqliteDialect({ database: database }),
    log: (e) => {
      if (e.level === "error") {
        console.error(e.error, "Something went wrong while migrating schema");
      }
    },
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(import.meta.dirname, "./migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === "Success") {
      // console.log(
      //   `migration "${result.migrationName}" was executed successfully`
      // );
    } else if (result.status === "Error") {
      console.error(
        { migration: result.migrationName },
        "Failed to execute migration"
      );
    }
  });

  if (error) {
    console.error(error, "Failed to migrate schema");
    process.exit(1);
  }

  await db.destroy();
}
