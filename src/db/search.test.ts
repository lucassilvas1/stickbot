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
import { _search } from "./search.js";
import { generateId } from "../utils/misc.js";
import { join } from "path";
import { TEST_DIR_PATH } from "../utils/constants.js";
import {
  clearDb,
  deleteTestFolder,
  generateStickerData,
  generateStickerVariants,
  mockCaches,
} from "./test.js";
import { initDb } from "./db.js";
import type { Kysely } from "kysely";
import type {
  Database,
  NewStickerWithoutTimestamps,
  NewVariant,
} from "../types/db.js";
import { _getStickerById, _insertSticker } from "./crud.js";

let db: Kysely<Database>;

describe.each([
  { useCache: true, label: "with cache" },
  { useCache: false, label: "without cache" },
])("full text search - $label", ({ useCache }) => {
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

  it("doesn't filter out stickers when no query is provided", async () => {
    const stickers = Array(5).fill(null).map(generateStickerData);
    const variants = stickers.map((s) => generateStickerVariants(s.id));
    await Promise.all(
      stickers.map((s, i) => _insertSticker(db, s, variants[i]!))
    );

    const results = await _search(db, {
      userId: stickers[0]!.uploaderId,
      limit: 10,
    });
    expect(results.stickers.length).toBe(5);
    expect(results.isLastPage).toBe(true);
    expect(results.totalResultCount).toBe(5);
  });

  it("properly paginates results", async () => {
    const stickerCount = 13;
    const { stickers } = await seedStickers(stickerCount);
    const userId = stickers[0]!.uploaderId;

    const page1 = await _search(db, { userId, limit: 5 });
    expect(page1.stickers.length).toBe(5);
    expect(page1.isLastPage).toBe(false);
    expect(page1.totalResultCount).toBe(stickerCount);

    const page2 = await _search(db, { userId, limit: 5, offset: 5 });
    expect(page2.stickers.length).toBe(5);
    expect(page2.isLastPage).toBe(false);

    const page3 = await _search(db, { userId, limit: 5, offset: 10 });
    expect(page3.stickers.length).toBe(3);
    expect(page3.isLastPage).toBe(true);

    const ids = [...page1.stickers, ...page2.stickers, ...page3.stickers].map(
      (s) => s.id
    );
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(stickerCount);
  });

  it("returns only relevant results", async () => {
    const stickers = [
      { ...generateStickerData(), tags: "funny sticker laughing" },
      { ...generateStickerData(), title: "specific sticker title" },
    ];
    const variants = stickers.map((s) => generateStickerVariants(s.id));
    await Promise.all(
      stickers.map((s, i) => _insertSticker(db, s, variants[i]!))
    );
    await seedStickers(10);

    const results = await _search(db, {
      query: "sticker",
      userId: stickers[0]!.uploaderId,
    });

    expect(new Set(results.stickers.map((s) => s.id))).toStrictEqual(
      new Set(stickers.map((s) => s.id))
    );
  });

  it("returns matches based on prefixes", async () => {
    const stickers = [
      { ...generateStickerData(), tags: "funny laugh" },
      { ...generateStickerData(), title: "tom cruise laughing" },
    ];
    const variants = stickers.map((s) => generateStickerVariants(s.id));
    await Promise.all(
      stickers.map((s, i) => _insertSticker(db, s, variants[i]!))
    );
    await seedStickers(10);

    const results = await _search(db, {
      query: "laugh",
      userId: stickers[0]!.uploaderId,
    });

    expect(new Set(results.stickers.map((s) => s.id))).toStrictEqual(
      new Set(stickers.map((s) => s.id))
    );
  });

  it("ignores anything that's not a Unicode letter, number, or space", async () => {
    const sticker = { ...generateStickerData(), tags: "NaZaRé confusa" };
    const variants = generateStickerVariants(sticker.id);
    await _insertSticker(db, sticker, variants);
    await seedStickers(10);

    const results = await _search(db, {
      query: "$n@a%z\na?re!",
      userId: sticker.uploaderId,
    });

    expect(new Set(results.stickers.map((s) => s.id))).toStrictEqual(
      new Set([sticker.id])
    );
  });

  it("sorts browse results by specified field", async () => {
    const stickers = [
      { ...generateStickerData(), tags: "funny laugh" },
      { ...generateStickerData(), tags: "funny kid" },
      { ...generateStickerData(), tags: "funny walk" },
      { ...generateStickerData(), tags: "funny meme" },
    ];
    const userId = "userid";
    const variants = stickers.map((s) => generateStickerVariants(s.id));
    await Promise.all(
      stickers.map((s, i) => _insertSticker(db, s, variants[i]!))
    );
    await seedStickers(10);

    vi.useFakeTimers();

    vi.advanceTimersByTime(10_000);
    await Promise.all(
      stickers.map((s) => _getStickerById(db, s.id, true, userId))
    );
    vi.advanceTimersByTime(10_000);
    await Promise.all(
      stickers.slice(1).map((s) => _getStickerById(db, s.id, true, userId))
    );
    vi.advanceTimersByTime(10_000);
    await Promise.all(
      stickers.slice(2).map((s) => _getStickerById(db, s.id, true, userId))
    );
    vi.advanceTimersByTime(10_000);
    await Promise.all(
      stickers.slice(3).map((s) => _getStickerById(db, s.id, true, userId))
    );

    vi.useRealTimers();

    const mostUsedResults = await _search(db, {
      query: "funny",
      userId,
      order: "usage.count",
    });

    const realMostUsedResults = await Promise.all(
      mostUsedResults.stickers.map((s) =>
        db
          .selectFrom("usage")
          .select("count")
          .where("userId", "=", userId)
          .where("stickerId", "=", s.id)
          .executeTakeFirst()
      )
    );

    const usage = realMostUsedResults.map((u) => u!.count);
    expect(usage).toStrictEqual(usage.toSorted((a, b) => b - a));

    const recentResults = await _search(db, {
      query: "funny",
      userId,
      order: "usage.timeLastUsed",
    });

    const realRecentResults = await Promise.all(
      recentResults.stickers.map((s) =>
        db
          .selectFrom("usage")
          .select("timeLastUsed")
          .where("userId", "=", userId)
          .where("stickerId", "=", s.id)
          .executeTakeFirst()
      )
    );

    const timestamps = realRecentResults.map((u) => u!.timeLastUsed);
    expect(timestamps).toStrictEqual(timestamps.toSorted((a, b) => b - a));
  });

  it("correctly handles offsets higher than total result count", async () => {
    const total = 20;
    await seedStickers(total);
    const results = await _search(db, { userId: "user", offset: 9999 });
    expect(results).toStrictEqual({
      stickers: [],
      isLastPage: true,
      totalResultCount: total,
    });
  });
});

async function seedStickers(
  amount: number,
  stickerModifier?: (
    sticker: NewStickerWithoutTimestamps
  ) => NewStickerWithoutTimestamps,
  variantModifier?: (variants: NewVariant[]) => NewVariant[]
) {
  const stickers = Array(amount)
    .fill(null)
    .map(() => {
      let sticker = generateStickerData();
      if (stickerModifier) sticker = stickerModifier(sticker);
      return sticker;
    });
  const variants = stickers.map((s) => {
    let variants = generateStickerVariants(s.id);
    if (variantModifier) variants = variantModifier(variants);
    return variants;
  });
  await Promise.all(
    stickers.map((s, i) => _insertSticker(db, s, variants[i]!))
  );
  return { stickers, variants };
}
