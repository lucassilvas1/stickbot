import { rm } from "fs/promises";
import { generateId, sanitizeString, type Cache } from "../utils/misc.js";
import { vi } from "vitest";
import { searchCache, stickerCache, userPermissionsCache } from "./cache.js";
import type { Kysely } from "kysely";
import type {
  Database,
  NewStickerWithoutTimestamps,
  NewVariant,
} from "../types/db.js";
import { VariantEncodingMap } from "../utils/constants.js";
import type { SimplifiedSticker } from "../types/stickers.js";

export function deleteTestFolder(rootPath: string) {
  return Promise.all([rm(rootPath, { recursive: true, force: true })]);
}

function mockCache(cache: Cache<any, any>) {
  const mockMap = new Map();

  vi.spyOn(cache, "get").mockReturnValue(undefined);
  vi.spyOn(cache, "entries").mockReturnValue(mockMap.entries());
}

export function mockCaches() {
  mockCache(userPermissionsCache);
  mockCache(stickerCache);
  mockCache(searchCache);
}

export async function clearDb(db: Kysely<Database>) {
  await db.deleteFrom("userPermissions").execute();
  // delete on cascade should handle variants
  await db.deleteFrom("sticker").execute();
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

  let pool = ASCII + ACCENTED;
  if (options.includeEmoji) pool += EMOJI.join("");

  let out = "";
  for (let i = 0; i < length; i++) {
    out += randomChar(pool);
  }
  return out;
}

function generateInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateStickerVariants(stickerId: string): NewVariant[] {
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

export function generateStickerData(): NewStickerWithoutTimestamps {
  return {
    id: generateId(8),
    title: generateTestString(16),
    tags: generateTestString(64),
    uploaderId: generateId(6),
    sourceUrl: "https://example.com",
  };
}

export function compareStickers(
  generated: NewStickerWithoutTimestamps,
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
