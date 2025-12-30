import { describe, expect, it } from "vitest";
import { searchCacheKey, type SearchCacheKey } from "./cache.js";

describe("searchCacheKey", () => {
  it("should return correct format with all parameters", () => {
    const result = searchCacheKey({
      userId: "user123",
      query: "test query",
      order: "usage.count",
    });
    expect(result).toBe("user123:test query:usage.count");
  });

  it("should return correct format with userId and query only", () => {
    const result = searchCacheKey({
      userId: "user123",
      query: "test query",
    });
    expect(result).toBe("user123:test query:");
  });

  it("should return correct format with userId and order only", () => {
    const result = searchCacheKey({
      userId: "user123",
      order: "usage.timeLastUsed",
    });
    expect(result).toBe("user123::usage.timeLastUsed");
  });

  it("should return correct format with userId only", () => {
    const result = searchCacheKey({
      userId: "user123",
    });
    expect(result).toBe("user123::");
  });

  it("should handle different search orders", () => {
    const userId = "user456";
    const query = "search";

    const result1 = searchCacheKey({
      userId,
      query,
      order: "usage.count",
    });
    expect(result1).toBe("user456:search:usage.count");

    const result2 = searchCacheKey({
      userId,
      query,
      order: "usage.timeLastUsed",
    });
    expect(result2).toBe("user456:search:usage.timeLastUsed");
  });

  it("should produce consistent results for the same inputs", () => {
    const input = {
      userId: "user789",
      query: "consistent",
      order: "usage.count" as const,
    };

    const result1 = searchCacheKey(input);
    const result2 = searchCacheKey(input);
    expect(result1).toBe(result2);
  });

  it("should distinguish between different queries", () => {
    const result1 = searchCacheKey({
      userId: "user123",
      query: "query1",
      order: "usage.count",
    });
    const result2 = searchCacheKey({
      userId: "user123",
      query: "query2",
      order: "usage.count",
    });
    expect(result1).not.toBe(result2);
  });

  it("should distinguish between different orders", () => {
    const result1 = searchCacheKey({
      userId: "user123",
      query: "test",
      order: "usage.count",
    });
    const result2 = searchCacheKey({
      userId: "user123",
      query: "test",
      order: "usage.timeLastUsed",
    });
    expect(result1).not.toBe(result2);
  });
});
