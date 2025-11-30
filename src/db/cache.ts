import type { UserPermissions } from "../types/db.js";
import type {
  SimplifiedSticker,
  StickerSearchOrder,
} from "../types/stickers.js";
import {
  SEARCH_CACHE_EXPIRATION_MS,
  STICKER_CACHE_EXPIRATION_MS,
  USER_PERMISSIONS_CACHE_EXPIRATION_MS,
} from "../utils/constants.js";
import { Cache } from "../utils/misc.js";

export const stickerCache = new Cache<string, SimplifiedSticker>(
  STICKER_CACHE_EXPIRATION_MS
);
// key format:
// - autocomplete: `auto::${query}:`
// - browse: `browse:${userId ?? ""}:${query ?? ""}:${order}`
export type SearchCacheKind = "browse" | "auto";
export type SearchCacheKey =
  | `${SearchCacheKind}:${string}:${string}:${StickerSearchOrder | ""}`
  | "invalid";

export function searchCacheKey({
  query,
  userId,
  order,
}: {
  query?: string;
  userId?: string;
  order?: StickerSearchOrder;
}): SearchCacheKey {
  if (!query && !userId) return "invalid"; // should not happen; caller returns early
  if (!userId && query) return `auto::${query}:`;
  return `browse:${userId ?? ""}:${query ?? ""}:${order ?? ""}`;
}

export const searchCache = new Cache<SearchCacheKey, string[]>(
  SEARCH_CACHE_EXPIRATION_MS
);
export const userPermissionsCache = new Cache<string, UserPermissions>(
  USER_PERMISSIONS_CACHE_EXPIRATION_MS
);

function invalidateAllSearchCaches() {
  searchCache.clear();
}

// When a sticker is updated (edit), call:
export function onStickerUpdated(
  stickerId: string,
  clearAllSearchCaches: boolean,
  {
    sticker,
    userId,
  }: {
    sticker?: SimplifiedSticker;
    userId?: string;
  } = {}
) {
  if (clearAllSearchCaches) invalidateAllSearchCaches();
  else if (userId) onUsageChangedForUser(userId);
  // remove or replace sticker object
  if (sticker) stickerCache.set(stickerId, sticker);
  else stickerCache.delete(stickerId);
}

// When usage for a (userId, stickerId) changed, we must invalidate browse caches for that user
function onUsageChangedForUser(userId: string) {
  // conservative: clear all browse caches for that user
  for (const [key] of Array.from(searchCache.entries())) {
    if (key.startsWith(`browse:${userId}`)) searchCache.delete(key);
  }
}
