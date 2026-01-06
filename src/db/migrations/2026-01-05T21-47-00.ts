import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.transaction().execute(async (trx) => {
    await trx.schema
      .createIndex("idx_user_permissions_username")
      .on("user_permissions")
      .columns(["username"])
      .execute();
  });
}

export async function down(db: Kysely<any>) {
  await db.transaction().execute(async (trx) => {
    await trx.schema.dropIndex("idx_user_permissions_username").execute();
  });
}
