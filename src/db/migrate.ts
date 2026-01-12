import * as path from "path";
import { promises as fs } from "fs";
import { Kysely, Migrator, FileMigrationProvider } from "kysely";
import { logger } from "../logging/logger.js";

export async function migrateToLatest(database: Kysely<any>) {
  const migrator = new Migrator({
    db: database,
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
      logger.debug({ migration: result.migrationName }, "migrated db");
    } else if (result.status === "Error") {
      logger.error(
        { migration: result.migrationName },
        "failed to execute migration"
      );
    }
  });

  if (error) {
    logger.error(error, "failed to migrate schema");
    process.exit(1);
  }
}
