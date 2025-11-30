import { describe, expect, it } from "vitest";
import { searchCacheKey } from "./cache.js";

describe("search cache key", () => {
  it('returns "invalid" when no query and no userId are provided', () => {
    expect(searchCacheKey({})).toBe("invalid");
  });

  it("recognizes an autocomplete request when only query is provided", () => {
    expect(searchCacheKey({ query: "funny" })).toBe("auto::funny:");
  });

  it("recognizes a browse request when userId is provided", () => {
    expect(searchCacheKey({ userId: "user123" }));
    expect(
      searchCacheKey({ userId: "user123", query: "cats", order: "usage.count" })
    ).toBe("browse:user123:cats:usage.count");
  });
});
