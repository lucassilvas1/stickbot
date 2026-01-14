import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  toAutocompleteType,
  autocomplete,
  getAssetUrl,
  getVariantUrl,
  getVariantPaths,
} from "./stickers.js";
import type { SimplifiedSticker } from "../types/stickers.js";
import { mockBoundDbFunctions, mockInteraction } from "./test.js";
import { env } from "../env.js";
import { join } from "path";

describe("toAutocompleteType", () => {
  it("transforms stickers to autocomplete format", () => {
    const stickers = [
      { id: "sticker1", title: "Dancing Cat" },
      { id: "sticker2", title: "Spinning Wheel" },
      { id: "sticker3", title: "Jumping Dog" },
    ] as SimplifiedSticker[];

    const result = toAutocompleteType(stickers);

    expect(result).toEqual([
      { name: "Dancing Cat", value: "sticker1" },
      { name: "Spinning Wheel", value: "sticker2" },
      { name: "Jumping Dog", value: "sticker3" },
    ]);
  });

  it("returns empty array when given empty stickers array", () => {
    const stickers: SimplifiedSticker[] = [];

    const result = toAutocompleteType(stickers);

    expect(result).toEqual([]);
  });

  it("handles single sticker", () => {
    const stickers = [
      { id: "abc123", title: "My Sticker" },
    ] as SimplifiedSticker[];

    const result = toAutocompleteType(stickers);

    expect(result).toEqual([{ name: "My Sticker", value: "abc123" }]);
  });

  it("preserves sticker order", () => {
    const stickers = [
      { id: "z", title: "Zebra" },
      { id: "a", title: "Apple" },
      { id: "m", title: "Mango" },
    ] as SimplifiedSticker[];

    const result = toAutocompleteType(stickers);

    expect(result[0]!.value).toBe("z");
    expect(result[1]!.value).toBe("a");
    expect(result[2]!.value).toBe("m");
  });
});

describe("autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches and returns matching stickers for valid query", async () => {
    const userId = "user";
    const interaction = mockInteraction({ userId });
    interaction.options.getString = vi.fn().mockReturnValue("cat");

    const stickers = [
      { id: "sticker1", title: "Dancing Cat" },
      { id: "sticker2", title: "Fat Cat" },
    ] as SimplifiedSticker[];

    const db = mockBoundDbFunctions();
    db.search.mockResolvedValue({
      stickers,
    } as any);

    await autocomplete(db as any, interaction as any);

    expect(db.search).toHaveBeenCalledWith({
      isAutocomplete: true,
      query: "cat",
      userId,
      order: env.AUTOCOMPLETE_ORDER_BY,
    });
    expect(interaction.respond).toHaveBeenCalledWith([
      { name: "Dancing Cat", value: "sticker1" },
      { name: "Fat Cat", value: "sticker2" },
    ]);
  });

  it("returns empty array when search returns no stickers", async () => {
    const interaction = mockInteraction();
    interaction.options.getString = vi.fn().mockReturnValue("nonexistent");

    const db = mockBoundDbFunctions();
    db.search.mockResolvedValue({
      stickers: [],
    } as any);

    await autocomplete(db as any, interaction as any);

    expect(interaction.respond).toHaveBeenCalledWith([]);
  });
});

describe("getAssetUrl", () => {
  it("constructs URL with hostname and relative path", () => {
    const url = getAssetUrl("high/sticker1.webp");

    expect(url).toMatch(/^https?:\/\/.+\/high\/sticker1\.webp$/);
  });

  it("removes leading slash from relative path", () => {
    const url = getAssetUrl("/high/sticker1.webp");

    // Should not have double slash in the middle
    expect(url).not.toContain("//high");
    expect(url.endsWith("high/sticker1.webp")).toBe(true);
  });

  it("handles path without leading slash", () => {
    const url = getAssetUrl("thumb/sticker2.webp");

    expect(url).toContain("/thumb/sticker2.webp");
  });

  it("handles paths with multiple directory levels", () => {
    const url = getAssetUrl("foo/bar/sticker3.webp");

    expect(url).toContain("foo/bar/sticker3.webp");
  });

  it("handles empty relative path", () => {
    const url = getAssetUrl("");

    // Should just be the hostname with trailing slash
    expect(url).toMatch(/^https?:\/\/.+\/$/);
  });

  it("preserves query parameters in path", () => {
    const url = getAssetUrl("high/sticker1.webp?v=1&format=webp");

    expect(url).toContain("high/sticker1.webp?v=1&format=webp");
  });

  it("handles special characters in path", () => {
    const url = getAssetUrl("high/my-sticker_v2.webp");

    expect(url).toContain("high/my-sticker_v2.webp");
  });
});

describe("getVariantUrl", () => {
  it("constructs URL for high variant", () => {
    const url = getVariantUrl("sticker123", "high");

    expect(url).toContain("high/sticker123.webp");
  });

  it("constructs URL for thumbnail variant", () => {
    const url = getVariantUrl("sticker456", "thumbnail");

    expect(url).toContain("thumb/sticker456.webp");
  });

  it("always outputs .webp extension", () => {
    const url1 = getVariantUrl("sticker1", "high");
    const url2 = getVariantUrl("sticker2", "thumbnail");

    expect(url1).toMatch(/\.webp$/);
    expect(url2).toMatch(/\.webp$/);
  });

  it("handles sticker IDs with special characters", () => {
    const url = getVariantUrl("sticker-123_abc", "high");

    expect(url).toContain("sticker-123_abc.webp");
  });

  it("constructs full valid URL", () => {
    const url = getVariantUrl("mySticker", "high");

    // Should be a valid URL-like format
    expect(url).toMatch(/^https?:\/\/.+\/high\/mySticker\.webp$/);
  });
});

describe("getVariantPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes high variant path with correct extension", () => {
    const paths = getVariantPaths("sticker1", "png");

    expect(paths.some((p) => p.includes("high") && p.endsWith(".webp"))).toBe(
      true
    );
  });

  it("includes thumbnail variant path with correct extension", () => {
    const paths = getVariantPaths("sticker1", "png");

    expect(paths.some((p) => p.includes("thumb") && p.endsWith(".webp"))).toBe(
      true
    );
  });

  it("includes original variant path", () => {
    const paths = getVariantPaths("sticker1", "png");

    expect(
      paths.some((p) => p.includes("original") && p.endsWith(".png"))
    ).toBe(true);
  });

  it("uses sticker ID in all paths", () => {
    const stickerId = "mySticker123";
    const paths = getVariantPaths(stickerId, "jpg");

    // All paths should contain the sticker ID
    expect(paths.every((p) => p.includes(stickerId))).toBe(true);
  });

  it("path format includes ASSETS_DIR_PATH", () => {
    const paths = getVariantPaths("sticker1", "png");
    const assetsRootPath = join(env.ASSETS_DIR_PATH); // Normalize slashes

    // Paths should be joined with directory separator
    expect(paths.every((p) => p.includes(assetsRootPath))).toBe(true);
  });

  it("variants always have .webp extension", () => {
    const paths = getVariantPaths("sticker1", "png");

    // All paths except original should end in .webp
    const nonOriginalPaths = paths.filter((p) => !p.includes("original"));
    expect(nonOriginalPaths.every((p) => p.endsWith(".webp"))).toBe(true);
  });
});
