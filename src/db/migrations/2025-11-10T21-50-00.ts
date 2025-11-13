import { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.transaction().execute(async (trx) => {
    await trx.schema
      .createTable("sticker")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("title", "text", (col) => col.notNull().unique())
      .addColumn("description", "text")
      .addColumn("usage_count", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("source_url", "text")
      .addColumn("uploader_id", "text")
      .addColumn("time_added", "integer", (col) => col.notNull())
      .addColumn("time_modified", "integer", (col) => col.notNull())
      .addColumn("time_last_used", "integer")
      .addColumn("tags", "text", (col) => col.notNull())
      .execute();

    await trx.schema
      .createTable("variant")
      .addColumn("sticker_id", "text", (col) =>
        col.references("sticker.id").notNull().onDelete("cascade")
      )
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("extension", "text", (col) => col.notNull())
      .addColumn("width", "integer", (col) => col.notNull())
      .addColumn("height", "integer", (col) => col.notNull())
      .addColumn("file_size_bytes", "integer", (col) => col.notNull())
      .addColumn("animated", "boolean", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_variant", ["sticker_id", "type"])
      .execute();

    await trx.schema
      .createTable("usage")
      .addColumn("sticker_id", "text", (col) =>
        col.references("sticker.id").notNull().onDelete("cascade")
      )
      .addColumn("user_id", "text", (col) => col.notNull())
      .addColumn("count", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("time_last_used", "integer", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_usage", ["sticker_id", "user_id"])
      .execute();

    await trx.schema
      .createIndex("idx_sticker_title")
      .on("sticker")
      .columns(["title"])
      .execute();
    await trx.schema
      .createIndex("idx_sticker_usage_count")
      .on("sticker")
      .columns(["usage_count"])
      .execute();
    await trx.schema
      .createIndex("idx_sticker_time_last_used")
      .on("sticker")
      .columns(["time_last_used"])
      .execute();
    await trx.schema
      .createIndex("idx_sticker_time_added")
      .on("sticker")
      .columns(["time_added"])
      .execute();

    await trx.schema
      .createIndex("idx_variant_type")
      .on("variant")
      .columns(["type"])
      .execute();
  });
}

export async function down() {}
