import { Kysely, sql } from "kysely";
import {
  simplifiedStickerColumns,
  type SimplifiedSticker,
  type StickerSearchOrder,
} from "../types/stickers.js";
import { sanitizeString } from "../utils/misc.js";
import { searchCache, searchCacheKey, stickerCache } from "./cache.js";
import type { Database } from "../types/db.js";

type StickerSearchOptions = {
  query?: string;
  userId?: string;
  offset?: number;
  limit?: number;
  order?: StickerSearchOrder;
};

async function hydrateStickers(
  db: Kysely<Database>,
  ids: string[]
): Promise<SimplifiedSticker[]> {
  const out: (SimplifiedSticker | undefined)[] = new Array(ids.length);
  const missingIds: string[] = [];

  // pass 1: fill out array with cached, track missing
  ids.forEach((id, i) => {
    const cached = stickerCache.get(id);
    if (cached) {
      out[i] = cached;
    } else {
      missingIds.push(id);
    }
  });

  if (missingIds.length > 0) {
    const fetched = await db
      .selectFrom("sticker")
      .select(simplifiedStickerColumns)
      .where("sticker.id", "in", missingIds)
      .execute();

    const byId = new Map(fetched.map((s) => [s.id, s]));

    // pass 2: fill holes + cache
    ids.forEach((id, i) => {
      if (!out[i]) {
        const s = byId.get(id);
        if (s) {
          stickerCache.set(id, s);
          out[i] = s;
        }
      }
    });
  }

  // cas out undefined, *if* cache invalidation logic is correct, there cannot
  // be any holes left at this point
  return out as SimplifiedSticker[];
}

function toFtsQuery(query?: string) {
  if (!query) return;
  return sanitizeString(query)
    .split(/\s+/)
    .map((token) => token + "*")
    .join(" ");
}

// build & execute search query, return ordered sticker ids (not hydrated)
async function runQueryAndCacheIds(
  db: Kysely<Database>,
  opts: StickerSearchOptions
): Promise<string[]> {
  const { query, userId, order, limit = 25 } = opts;
  let sb = db.selectFrom("sticker").select(simplifiedStickerColumns);

  if (query) {
    const ftsQuery = toFtsQuery(query);
    sb = sb
      .innerJoin("stickerFts", "sticker.rowid", "stickerFts.rowid")
      .where(() => sql`sticker_fts MATCH ${ftsQuery}`)
      .orderBy(sql`bm25(sticker_fts)`);
  }

  if (userId) {
    // left join usage and order by chosen user metric (coalesce to treat nulls as 0)
    sb = sb.leftJoin("usage", (jb) =>
      jb
        .onRef("usage.stickerId", "=", "sticker.id")
        .on("usage.userId", "=", userId)
    );

    if (order === "usage.count") {
      sb = sb.orderBy(sql`coalesce(usage.count, 0)`, "desc");
    } else if (order === "usage.timeLastUsed") {
      sb = sb.orderBy(sql`coalesce(usage.time_last_used, 0)`, "desc");
    }
  }

  // limit fetch size we cache; pagination will be done by ids slicing
  const rows = await sb.limit(limit).execute();

  // ensure stickers are cached and return ordered ids
  const ids = rows.map((r) => {
    stickerCache.set(r.id, r);
    return r.id;
  });

  return ids;
}

export async function _search(
  db: Kysely<Database>,
  opts: StickerSearchOptions = {}
) {
  const { query, userId, offset, limit = 25, order } = opts;

  const key = searchCacheKey({ query, userId, order });
  // check cache (if cache hit, we have an ordered array of ids)
  let ids = searchCache.get(key);
  // guard: blank autocomplete
  if (key === "invalid")
    return { stickers: [], isLastPage: true, totalResultCount: 0 };

  if (!ids) {
    // cache miss: run query and cache ids
    // NOTE: for autocomplete, we run the same query but with limit 25
    const runLimit = userId ? 5000 : 25;
    ids = await runQueryAndCacheIds(db, {
      query,
      userId,
      order,
      limit: runLimit,
    });
    // store in cache
    searchCache.set(key, ids);
  }

  // paginate the ids list (safe slicing)
  const start = offset ?? 0;
  const end = start + limit;
  const pageIds = ids.slice(start, end);
  const isLastPage = end >= ids.length;

  // hydrate sticker objects (from stickerCache, fetching missing)
  const stickers = await hydrateStickers(db, pageIds);

  return { stickers, isLastPage, totalResultCount: ids.length };
}
