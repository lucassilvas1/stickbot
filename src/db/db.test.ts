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
import { env } from "../env.js";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { initDb } from "./db.js";
import { Kysely, sql } from "kysely";
import {
  ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME,
  VariantEncodingMap,
} from "../utils/constants.js";
import type {
  Database,
  NewSticker,
  NewUserPermissions,
  NewVariant,
  Permissions,
} from "../types/db.js";
import {
  _deleteSticker,
  _deleteUserPermissions,
  _getStickerById,
  _getUserPermissionsById,
  _incrementStickerUsage,
  _insertSticker,
  _insertUserPermissions,
  _updateSticker,
  _updateUserPermissions,
} from "./crud.js";
import { rm } from "fs/promises";
import { Cache, generateId, sanitizeString } from "../utils/misc.js";
import type { SimplifiedSticker } from "../types/stickers.js";
import { searchCache, stickerCache, userPermissionsCache } from "./cache.js";

let db: Kysely<Database>;
const permissions: (keyof Permissions)[] = [
  "addSticker",
  "editSticker",
  "deleteSticker",
  "addUser",
  "editUser",
  "deleteUser",
] as const;

async function clearDb() {
  await db.deleteFrom("userPermissions").execute();
  // delete on cascade should handle variants
  await db.deleteFrom("sticker").execute();
}

function mockCache(cache: Cache<any, any>) {
  const mockMap = new Map();

  vi.spyOn(cache, "get").mockReturnValue(undefined);
  vi.spyOn(cache, "entries").mockReturnValue(mockMap.entries());
}

function mockCaches() {
  mockCache(userPermissionsCache);
  mockCache(stickerCache);
  mockCache(searchCache);
}

describe.each([
  { useCache: true, label: "with cache" },
  { useCache: false, label: "without cache" },
])("database - $label", () => {
  beforeAll(async () => {
    await deleteTestFolder();
    db = await initDb();
  });

  beforeEach(() => {
    mockCaches();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDb();
  });

  afterAll(async () => {
    await db.destroy();
    await deleteTestFolder();
  });

  it("creates sticker variant directories", async () => {
    const originalPath = join(
      env.ASSETS_DIR_PATH,
      ORIGINAL_MEDIA_DOWNLOAD_DIR_NAME
    );
    expect(existsSync(originalPath)).toBe(true);
    for (const { dirName } of Object.values(VariantEncodingMap)) {
      const variantPath = join(env.ASSETS_DIR_PATH, dirName);
      expect(existsSync(variantPath)).toBe(true);
    }
  });

  it("moves static files to assets directory", async () => {
    const originalPath = join(import.meta.dirname, "../../assets");
    const names = readdirSync(originalPath);
    for (const name of names) {
      const destPath = join(env.ASSETS_DIR_PATH, name);
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
    const result = await _insertUserPermissions(db, user);

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
      users.map((user) => _insertUserPermissions(db, user))
    );
    expect(result.every(Boolean)).toBe(true);

    const targetUser = users[5]!;
    const retrievedUser = await _getUserPermissionsById(db, targetUser.id);
    expect(retrievedUser).toStrictEqual(targetUser);
  });

  it("does not insert duplicate user permissions", async () => {
    const user = generateRandomUser();
    const firstInsert = await _insertUserPermissions(db, user);
    expect(firstInsert).toBe(true);
    const secondInsert = await _insertUserPermissions(db, user);
    expect(secondInsert).toBe(false);
  });

  it("defaults permission values to 0 (false)", async () => {
    const id = generateId(6);
    await _insertUserPermissions(db, { id, username: generateId(6) });
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
    await _insertUserPermissions(db, user);

    const userFlipped = { ...user };
    permissions.forEach((p) => {
      userFlipped[p] = ~~!user[p];
    });
    const updated = await _updateUserPermissions(db, user.id, userFlipped);
    expect(updated).toBe(true);

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
    await _insertUserPermissions(db, target);
    await _insertUserPermissions(db, other);
    await _deleteUserPermissions(db, target.id);
    const users = await db.selectFrom("userPermissions").selectAll().execute();
    expect(users).toStrictEqual([other]);
  });

  it("inserts new sticker and variants", async () => {
    const newSticker = generateStickerData();
    const variants = generateStickerVariants(newSticker.id);
    await _insertSticker(db, newSticker, variants);

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
    await _insertSticker(db, sticker, generateStickerVariants(sticker.id));
    const now = Date.now();
    await _incrementStickerUsage(db, sticker.id, sticker.uploaderId);
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
    await _insertSticker(db, sticker, generateStickerVariants(sticker.id));

    const before = Date.now();
    await new Promise((r) => setTimeout(r, 10));
    await _incrementStickerUsage(
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
    await _insertSticker(db, sticker, variants);

    const fetchedSticker = await _getStickerById(db, sticker.id);
    expect(compareStickers(sticker, fetchedSticker!)).toBe(true);
    expect(fetchedSticker!.usageCount).toBe(1);
  });

  it("retrieves simplified sticker and increments usage", async () => {
    const target = generateStickerData();
    const variants = generateStickerVariants(target.id);
    await _insertSticker(db, target, variants);

    const other = generateStickerData();
    const otherVariants = generateStickerVariants(other.id);
    await _insertSticker(db, other, otherVariants);

    const fetchedTarget = await _getStickerById(
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

    const fetchedOther = await _getStickerById(db, other.id);
    expect(fetchedOther!.usageCount).toBe(1);
  });

  it("updates sticker title and tags", async () => {
    const target = generateStickerData();
    const targetVariants = generateStickerVariants(target.id);
    await _insertSticker(db, target, targetVariants);

    const other = generateStickerData();
    const otherVariants = generateStickerVariants(other.id);
    await _insertSticker(db, other, otherVariants);

    const newTitle = generateTestString(20);
    const newTags = generateTestString(40);
    await _updateSticker(db, target.id, { title: newTitle, tags: newTags });
    const updatedSticker = await _getStickerById(db, target.id);
    expect(updatedSticker!.title).toBe(sanitizeString(newTitle));
    expect(updatedSticker!.tags).toBe(sanitizeString(newTags));

    const otherSticker = await _getStickerById(db, other.id);
    expect(compareStickers(other, otherSticker!)).toBe(true);
  });

  it("does not update non-editable fields", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await _insertSticker(db, sticker, variants);

    await _updateSticker(db, sticker.id, {
      usageCount: 1000,
      timeLastUsed: Date.now() + 1000000,
    });

    const updatedSticker = await _getStickerById(db, sticker.id);
    expect(updatedSticker!.usageCount).toBe(1);
    expect(updatedSticker!.timeLastUsed).toBeLessThanOrEqual(Date.now());
  });

  it("deletes stickers from database and filesystem", async () => {
    const sticker = generateStickerData();
    const variants = generateStickerVariants(sticker.id);
    await _insertSticker(db, sticker, variants);

    const processingModule = await import("../utils/processing.js");
    const spy = vi.spyOn(processingModule, "deleteVariants");

    await _deleteSticker(db, sticker.id);

    const fetchedSticker = await _getStickerById(db, sticker.id);
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
    await _insertSticker(db, sticker, variants);

    await db.deleteFrom("sticker").where("id", "=", sticker.id).execute();

    const v = await db.selectFrom("variant").selectAll().execute();
    expect(v.length).toBe(0);

    const u = await db.selectFrom("usage").selectAll().execute();
    expect(u.length).toBe(0);
  });
});

function compareStickers(
  generated: Omit<NewSticker, "timeAdded" | "timeModified">,
  fetched: SimplifiedSticker
) {
  const sanitized = {
    ...generated,
    title: sanitizeString(generated.title),
    tags: sanitizeString(generated.tags),
  };
  const commonFields = ["id", "title", "tags", "uploaderId"] as const;

  return (
    commonFields.every((field) => sanitized[field] === fetched[field]) &&
    typeof fetched.usageCount === "number" &&
    typeof fetched.timeLastUsed === "number"
  );
}

function generateStickerVariants(stickerId: string): NewVariant[] {
  return Object.values(VariantEncodingMap).map(({ name }) => ({
    stickerId,
    type: name as NewVariant["type"],
    extension: "webp",
    width: generateInt(64, 512),
    height: generateInt(64, 512),
    fileSizeBytes: generateInt(1000, 50000),
    animated: Math.round(Math.random()),
  }));
}

function generateStickerData(): Omit<NewSticker, "timeAdded" | "timeModified"> {
  return {
    id: generateId(8),
    title: generateTestString(16),
    tags: generateTestString(64),
    uploaderId: generateId(6),
    sourceUrl: "https://example.com",
  };
}

function generateInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateTestString(
  length = 20,
  options = { includeEmoji: false }
): string {
  function randomChar(pool: string): string {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  const ASCII =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

  const ACCENTED = "áàãâäåéèêëíìîïóòõôöúùûüçñ" + "ÁÀÃÂÄÅÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ";

  const SPECIAL = `!@#$%^&*()_+-=[]{};:'",.<>/?\\|~\``;

  const EMOJI = [
    "😀",
    "😂",
    "😅",
    "😍",
    "🤔",
    "👍",
    "🔥",
    "✨",
    "🎉",
    "❤️",
    "💀",
    "🤡",
    "😎",
  ];

  let pool = ASCII + ACCENTED + SPECIAL;
  if (options.includeEmoji) pool += EMOJI.join("");

  let out = "";
  for (let i = 0; i < length; i++) {
    out += randomChar(pool);
  }
  return out;
}

function generateRandomUser() {
  const user: Record<string, any> = {
    id: generateId(6),
    username: generateId(6),
  };
  permissions.forEach((p) => (user[p] = Math.round(Math.random())));
  return user as NewUserPermissions;
}

function deleteTestFolder() {
  return Promise.all([
    rm(env.ASSETS_DIR_PATH, { recursive: true, force: true }),
    rm(env.DB_DIR_PATH, { recursive: true, force: true }),
  ]);
}
