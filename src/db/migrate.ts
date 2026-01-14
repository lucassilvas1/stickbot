import { join } from "path";
import { promises as fs } from "fs";
import { platform } from "node:process";
import { Kysely, Migrator, type Migration } from "kysely";
import { logger } from "../logging/logger.js";
import { pathToFileURL } from "node:url";

function isObject(obj: unknown) {
  return typeof obj === "object" && obj !== null;
}

function isFunction(obj: unknown) {
  return typeof obj === "function";
}

class FileMigrationProvider {
  constructor(private migrationFolder: string) {}

  static isMigration(obj: Record<string, any>) {
    return isObject(obj) && isFunction(obj.up);
  }
  async getMigrations() {
    const migrations: Record<string, Migration> = {};
    const files = await fs.readdir(this.migrationFolder);
    for (const fileName of files) {
      if (
        fileName.endsWith(".js") ||
        (fileName.endsWith(".ts") && !fileName.endsWith(".d.ts")) ||
        fileName.endsWith(".mjs") ||
        (fileName.endsWith(".mts") && !fileName.endsWith(".d.mts"))
      ) {
        let migrationPath = join(this.migrationFolder, fileName);
        if (platform === "win32") {
          migrationPath = pathToFileURL(migrationPath).toString();
        }

        const migration = await import(migrationPath);
        const migrationKey = fileName.substring(0, fileName.lastIndexOf("."));

        if (FileMigrationProvider.isMigration(migration?.default)) {
          migrations[migrationKey] = migration.default;
        } else if (FileMigrationProvider.isMigration(migration)) {
          migrations[migrationKey] = migration;
        }
      }
    }
    return migrations;
  }
}

export async function migrateToLatest(database: Kysely<any>) {
  const migrator = new Migrator({
    db: database,
    provider: new FileMigrationProvider("./migrations"),
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
