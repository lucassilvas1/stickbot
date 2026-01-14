import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { initDb } from "./db.js";
import { Kysely, sql } from "kysely";
import {
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  TEST_DIR_PATH,
  VariantEncodingMap,
} from "../utils/constants.js";
import type { Database, NewUserPermissions, Permissions } from "../types/db.js";
import {
  deleteSticker,
  deleteUserPermissions,
  getUsers,
  getStickerById,
  getStickerByTitle,
  getUserPermissionsById,
  incrementStickerUsage,
  insertSticker,
  insertUserPermissions,
  updateSticker,
  updateUserPermissions,
} from "./crud.js";
import { generateId, sanitizeString } from "../utils/misc.js";
import {
  clearDb,
  compareStickers,
  deleteTestFolder,
  generateStickerData,
  generateStickerVariants,
  generateTestString,
  mockCaches,
  seedStickers,
} from "./test.js";

let db: Kysely<Database>;
const permissions: (keyof Permissions)[] = [
  "addSticker",
  "editSticker",
  "deleteSticker",
  "addUser",
  "editUser",
  "deleteUser",
] as const;

describe.each([
  { useCache: true, label: "with cache" },
  { useCache: false, label: "without cache" },
])("database - $label", ({ useCache }) => {
  const randomSuffix = generateId(6);
  const testDirPath = join(TEST_DIR_PATH, randomSuffix);
  const testDbDirPath = join(testDirPath, "db");
  const testAssetsDirPath = join(testDirPath, "assets");

  beforeAll(async () => {
    await deleteTestFolder(testDbDirPath);
    db = await initDb({
      dbDirPath: testDbDirPath,
      assetsDirPath: testAssetsDirPath,
    });
  });

  beforeEach(() => {
    if (!useCache) mockCaches();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDb(db);
  });

  afterAll(async () => {
    await db.destroy();
    await deleteTestFolder(testDirPath);
  });

  it("creates sticker variant directories", async () => {
    const originalPath = join(
      testAssetsDirPath,
      ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME
    );
    expect(existsSync(originalPath)).toBe(true);
    for (const { dirName } of Object.values(VariantEncodingMap)) {
      const variantPath = join(testAssetsDirPath, dirName);
      expect(existsSync(variantPath)).toBe(true);
    }
  });

  it("moves static files to assets directory", async () => {
    const originalPath = join(import.meta.dirname, "../../assets");
    const names = readdirSync(originalPath);
    for (const name of names) {
      const destPath = join(testAssetsDirPath, name);
      expect(existsSync(destPath)).toBe(true);
    }
  });

  it("runs all migrations", async () => {
    const ranMigrations = await sql`SELECT name FROM kysely_migration`.execute(
      db
    );

    const migrationFiles = readdirSync(
      join(import.meta.dirname, "./migrations")
    );
    expect(ranMigrations.rows.length).toBe(migrationFiles.length);
  });

  it("inserts user permissions in db", async () => {
    const user = generateRandomUser();
    const result = await insertUserPermissions(db, user);

    expect(result).toBe(true);

    const insertedUser = await db
      .selectFrom("userPermissions")
      .selectAll()
      .where("id", "=", user.id)
      .executeTakeFirst();

    expect(insertedUser).toStrictEqual(user);
  });

  it("retrieves permissions for the correct user", async () => {
    const users = Array(10).fill(null).map(generateRandomUser);
    const result = await Promise.all(
      users.map((user) => insertUserPermissions(db, user))
    );
    expect(result.every(Boolean)).toBe(true);

    const targetUser = users[5]!;
    const retrievedUser = await getUserPermissionsById(db, targetUser.id);
    expect(retrievedUser).toStrictEqual(targetUser);
  });

  it("does not insert duplicate user permissions", async () => {
    const user = generateRandomUser();
    const firstInsert = await insertUserPermissions(db, user);
    expect(firstInsert).toBe(true);
    const secondInsert = await insertUserPermissions(db, user);
    expect(secondInsert).toBe(false);
  });

  it("defaults permission values to 0 (false)", async () => {
    const id = generateId(6);
    await insertUserPermissions(db, { id, username: generateId(6) });
    const insertedUser = await db
      .selectFrom("userPermissions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    expect(insertedUser).toBeDefined();
    permissions.forEach((p) => expect(insertedUser![p]).toBe(0));
  });

  it("updates user permissions", async () => {
    const user = generateRandomUser();
    await insertUserPermissions(db, user);

    const userFlipped = { ...user };
    permissions.forEach((p) => {
      userFlipped[p] = ~~!user[p];
    });
    const updated = await updateUserPermissions(db, user.id, userFlipped);
    expect(updated).toStrictEqual(userFlipped);

    const retrievedUser = await db
      .selectFrom("userPermissions")
      .selectAll()
      .where("id", "=", user.id)
      .executeTakeFirst();
    expect(retrievedUser).toStrictEqual(userFlipped);
  });

  it("deletes user permissions", async () => {
    const target = generateRandomUser();
    const other = generateRandomUser();
    await insertUserPermissions(db, target);
    await insertUserPermissions(db, other);
    await deleteUserPermissions(db, target.id);
    const users = await db.selectFrom("userPermissions").selectAll().execute();
    expect(users).toStrictEqual([other]);
  });

  it("retrieves paginated users in ascending username order", async () => {
    const users = [
      { id: "user1", username: "charlie" },
      { id: "user2", username: "alice" },
      { id: "user3", username: "bob" },
    ];
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 0, 10);

    expect(result.users).toHaveLength(3);
    expect(result.users[0]!.username).toBe("alice");
    expect(result.users[1]!.username).toBe("bob");
    expect(result.users[2]!.username).toBe("charlie");
  });

  it("returns correct isLastPage when on last page", async () => {
    const users = Array(5)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 0, 5);

    expect(result.isLastPage).toBe(true);
    expect(result.totalResultCount).toBe(5);
  });

  it("returns correct isLastPage when not on last page", async () => {
    const users = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 0, 5);

    expect(result.isLastPage).toBe(false);
    expect(result.users).toHaveLength(5);
  });

  it("handles offset correctly", async () => {
    const users = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${String(i).padStart(2, "0")}`, // user00, user01, etc.
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 5, 3);

    expect(result.users).toHaveLength(3);
    expect(result.users[0]!.username).toBe("user05");
    expect(result.users[1]!.username).toBe("user06");
    expect(result.users[2]!.username).toBe("user07");
  });

  it("returns correct totalResultCount", async () => {
    const users = Array(7)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 0, 3);

    expect(result.totalResultCount).toBe(7);
  });

  // it("caches users after retrieval", async () => {
  //   const user = generateRandomUser();
  //   await insertUserPermissions(db, user);

  //   const result = await getUsers(db, 0, 10);

  //   const cachedModule = await import("./cache.js");
  //   const cachedUser = cachedModule.userPermissionsCache.get(user.id);
  //   expect(cachedUser).toBeDefined();
  //   expect(cachedUser).toStrictEqual(user);
  // });

  it("returns empty array when offset exceeds total users", async () => {
    const users = Array(5)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 10, 5);

    expect(result.users).toHaveLength(0);
    expect(result.isLastPage).toBe(true);
    expect(result.totalResultCount).toBe(5);
  });

  it("works with single user", async () => {
    const user = generateRandomUser();
    await insertUserPermissions(db, user);

    const result = await getUsers(db, 0, 10);

    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toStrictEqual(user);
    expect(result.isLastPage).toBe(true);
    expect(result.totalResultCount).toBe(1);
  });

  it("handles multiple pages correctly", async () => {
    const users = Array(25)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${String(i).padStart(2, "0")}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const page1 = await getUsers(db, 0, 10);
    const page2 = await getUsers(db, 10, 10);
    const page3 = await getUsers(db, 20, 10);

    expect(page1.users).toHaveLength(10);
    expect(page1.isLastPage).toBe(false);
    expect(page2.users).toHaveLength(10);
    expect(page2.isLastPage).toBe(false);
    expect(page3.users).toHaveLength(5);
    expect(page3.isLastPage).toBe(true);
    expect(page1.totalResultCount).toBe(25);
    expect(page3.totalResultCount).toBe(25);
  });

  it("returns users with all their permissions", async () => {
    const user: NewUserPermissions = {
      id: "testuser",
      username: "testuser",
      addSticker: 1,
      editSticker: 0,
      deleteSticker: 1,
      addUser: 0,
      editUser: 1,
      deleteUser: 0,
    };
    await insertUserPermissions(db, user);

    const result = await getUsers(db, 0, 10);

    expect(result.users[0]).toStrictEqual(user);
  });

  it("limits results correctly when limit exceeds available users", async () => {
    const users = Array(3)
      .fill(null)
      .map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
      }));
    for (const user of users) {
      await insertUserPermissions(db, user as NewUserPermissions);
    }

    const result = await getUsers(db, 0, 100);

    expect(result.users).toHaveLength(3);
    expect(result.isLastPage).toBe(true);
  });

  it("inserts new sticker and variants", async () => {
    const newSticker = generateStickerData();
    const variants = generateStickerVariants(newSticker.id);
    await insertSticker(db, newSticker, variants);

    const insertedSticker = await db
      .selectFrom("sticker")
      .selectAll()
      .where("id", "=", newSticker.id)
      .executeTakeFirst();
    // titles and tags should be sanitized
    expect(insertedSticker!.title).toBe(sanitizeString(newSticker.title));
    expect(insertedSticker!.tags).toBe(sanitizeString(newSticker.tags));
    // timestamps should be set to now
    expect(insertedSticker!.timeAdded).toBeLessThanOrEqual(Date.now());
    expect(insertedSticker!.timeLastUsed).toBeLessThanOrEqual(Date.now());
    expect(insertedSticker!.timeModified).toBeLessThanOrEqual(Date.now());
    // usage count should be 1 on insert to move it to the front of the list
    expect(insertedSticker!.usageCount).toBe(1);

    const insertedVariants = await db
      .selectFrom("variant")
      .selectAll()
      .where("stickerId", "=", newSticker.id)
      .execute();
    expect(insertedVariants).toStrictEqual(variants);
  });

  it("increments usage stats for a user and sticker", async () => {
    const sticker = generateStickerData();
    await insertSticker(db, sticker, generateStickerVariants(sticker.id));
    const now = Date.now();
    await incrementStickerUsage(db, sticker.id, sticker.uploaderId);
    const usage = await db
      .selectFrom("usage")
      .selectAll()
      .where("stickerId", "=", sticker.id)
      .where("userId", "=", sticker.uploaderId)
      .executeTakeFirst();
    expect(usage!.count).toBe(2);
    expect(usage!.timeLastUsed).toBeGreaterThanOrEqual(now);
    const stickerRecord = await db
      .selectFrom("sticker")
      .selectAll()
      .where("id", "=", sticker.id)
      .executeTakeFirst();
    expect(stickerRecord!.usageCount).toBe(2);
    expect(stickerRecord!.timeLastUsed).toBeGreaterThanOrEqual(now);
  });

  it("should be able to increment usage stats only for the user", async () => {
    const sticker = generateStickerData();
    await insertSticker(db, sticker, generateStickerVariants(sticker.id));

    const before = Date.now();
    await new Promise((r) => setTimeout(r, 10));
    await incrementStickerUsage(
      db,
      sticker.id,
      sticker.uploaderId,
      undefined,
      false
    );

    const usage = await db
      .selectFrom("usage")
      .selectAll()
      .where("stickerId", "=", sticker.id)
      .where("userId", "=", sticker.uploaderId)
      .executeTakeFirst();
    expect(usage!.count).toBe(2);
    expect(usage!.timeLastUsed).toBeGreaterThan(before);

    const stickerRecord = await db
      .selectFrom("sticker")
      .selectAll()
      .where("id", "=", sticker.id)
      .executeTakeFirst();
    expect(stickerRecord!.usageCount).toBe(1);
    expect(stickerRecord!.timeLastUsed).toBeLessThanOrEqual(before);
  });

  it("retrieves simplified sticker by id without incrementing usage", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await insertSticker(db, sticker, variants);

    const fetchedSticker = await getStickerById(db, sticker.id);
    expect(compareStickers(sticker, fetchedSticker!)).toBe(true);
    expect(fetchedSticker!.usageCount).toBe(1);
  });

  it("retrieves simplified sticker and increments usage", async () => {
    const target = generateStickerData();
    const variants = generateStickerVariants(target.id);
    await insertSticker(db, target, variants);

    const other = generateStickerData();
    const otherVariants = generateStickerVariants(other.id);
    await insertSticker(db, other, otherVariants);

    const fetchedTarget = await getStickerById(
      db,
      target.id,
      true,
      target.uploaderId
    );
    expect(compareStickers(target, fetchedTarget!)).toBe(true);
    expect(fetchedTarget!.usageCount).toBe(2);

    const targetUsage = await db
      .selectFrom("usage")
      .selectAll()
      .where("stickerId", "=", target.id)
      .where("userId", "=", target.uploaderId)
      .executeTakeFirst();
    expect(targetUsage!.count).toBe(2);

    const fetchedOther = await getStickerById(db, other.id);
    expect(fetchedOther!.usageCount).toBe(1);
  });

  it("retrieves simplified sticker by title", async () => {
    const title = "UniqueTitle123";
    const sticker = generateStickerData({ title });
    const variants = generateStickerVariants(sticker.id);
    await insertSticker(db, sticker, variants);
    await seedStickers(db, insertSticker, 5);

    const fetchedSticker = await getStickerByTitle(db, title);
    expect(compareStickers(sticker, fetchedSticker!)).toBe(true);
  });

  it("updates sticker title and tags", async () => {
    const target = generateStickerData();
    const targetVariants = generateStickerVariants(target.id);
    await insertSticker(db, target, targetVariants);

    const other = generateStickerData();
    const otherVariants = generateStickerVariants(other.id);
    await insertSticker(db, other, otherVariants);

    const newTitle = generateTestString(20);
    const newTags = generateTestString(40);
    await updateSticker(db, target.id, { title: newTitle, tags: newTags });
    const updatedSticker = await getStickerById(db, target.id);
    expect(updatedSticker!.title).toBe(sanitizeString(newTitle));
    expect(updatedSticker!.tags).toBe(sanitizeString(newTags));

    const otherSticker = await getStickerById(db, other.id);
    expect(compareStickers(other, otherSticker!)).toBe(true);
  });

  it("does not update non-editable fields", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await insertSticker(db, sticker, variants);

    await updateSticker(db, sticker.id, {
      usageCount: 1000,
      timeLastUsed: Date.now() + 1000000,
    });

    const updatedSticker = await getStickerById(db, sticker.id);
    expect(updatedSticker!.usageCount).toBe(1);
    expect(updatedSticker!.timeLastUsed).toBeLessThanOrEqual(Date.now());
  });

  it("deletes stickers from database and filesystem", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await insertSticker(db, sticker, variants);

    const processingModule = await import("../utils/processing.js");
    const spy = vi.spyOn(processingModule, "deleteAllVariants");

    await deleteSticker(db, sticker.id);

    const fetchedSticker = await getStickerById(db, sticker.id);
    expect(fetchedSticker).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);

    const variantRecords = await db
      .selectFrom("variant")
      .selectAll()
      .where("stickerId", "=", sticker.id)
      .execute();
    expect(variantRecords.length).toBe(0);
  });

  it("deletes tables on cascade", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await insertSticker(db, sticker, variants);

    await db.deleteFrom("sticker").where("id", "=", sticker.id).execute();

    const v = await db.selectFrom("variant").selectAll().execute();
    expect(v.length).toBe(0);

    const u = await db.selectFrom("usage").selectAll().execute();
    expect(u.length).toBe(0);
  });
});

function generateRandomUser() {
  const user: Record<string, any> = {
    id: generateId(6),
    username: generateId(6),
  };
  permissions.forEach((p) => (user[p] = Math.round(Math.random())));
  return user as NewUserPermissions;
}
