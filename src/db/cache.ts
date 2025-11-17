import type { UserPermissions } from "../types/db.js";
import type { SimplifiedSticker } from "../types/stickers.js";
import { Constants } from "../utils/index.js";
import { Cache } from "../utils/misc.js";

export const stickerCache = new Cache<string, SimplifiedSticker>(
  Constants.STICKER_CACHE_EXPIRATION_MS
);
// key format:
// - autocomplete: `auto:${query}`
// - browse: `browse:${userId ?? ""}:${query ?? ""}:${order}`
export const searchCache = new Cache<string, string[]>(
  Constants.SEARCH_CACHE_EXPIRATION_MS
);
export const userPermissionsCache = new Cache<string, UserPermissions>(
  Constants.USER_PERMISSIONS_CACHE_EXPIRATION_MS
);

export function clearAllSearchCaches() {
  searchCache.clear();
}

// When a sticker is updated (edit), call:
export function onStickerUpdated(stickerId: string) {
  clearAllSearchCaches();
  // remove sticker object
  stickerCache.delete(stickerId);
}

// When usage for a (userId, stickerId) changed, we must invalidate browse caches for that user
export function onUsageChangedForUser(userId: string, stickerId?: string) {
  // conservative: clear all browse caches for that user
  for (const [key] of Array.from(searchCache.entries())) {
    if (key.startsWith(`browse:${userId}:`)) searchCache.delete(key);
  }
  if (stickerId) {
    // also evict single sticker to force fresh data if needed
    stickerCache.delete(stickerId);
  }
}
