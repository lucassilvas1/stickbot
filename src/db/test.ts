import { rm } from "fs/promises";
import type { Cache } from "../utils/misc.js";
import { vi } from "vitest";
import { searchCache, stickerCache, userPermissionsCache } from "./cache.js";

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
