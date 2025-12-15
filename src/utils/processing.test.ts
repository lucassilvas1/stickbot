import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getVariantInfo,
  saveFile,
  deleteAllVariants,
  buildFfmpegArgs,
  ffmpeg,
  processWebp,
} from "./processing.js";
import { spawn } from "./misc.js";
import * as miscModule from "./misc.js";
import * as fsModule from "fs";
import * as fspromisesModule from "fs/promises";
import { EventEmitter } from "events";
import { env } from "../env.js";
import { join } from "path";
import sharp from "sharp";
import type { StickerVariantEncodingConfig } from "../types/stickers.js";

vi.mock("fs");
vi.mock("fs/promises");

vi.mock("./misc.js", async () => {
  const actual = await vi.importActual<typeof import("./misc.js")>("./misc.js");
  return {
    spawn: vi.fn(),
    TypedError: actual.TypedError,
  };
});

const metadataMock = vi.fn();
const resizeMock = vi.fn().mockReturnThis();
const webpMock = vi.fn().mockReturnThis();
const toFileMock = vi.fn();

vi.mock("sharp", () => {
  return {
    default: vi.fn(() => ({
      metadata: metadataMock,
      resize: resizeMock,
      webp: webpMock,
      toFile: toFileMock,
    })),
  };
});

describe("getVariantInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns variant info for valid media file", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 102400 } as any);
    vi.mocked(spawn).mockResolvedValue("1920,1080,60");

    const result = await getVariantInfo(
      "sticker1",
      "high",
      "/path/to/file.mp4"
    );

    expect(result).toEqual({
      stickerId: "sticker1",
      type: "high",
      width: 1920,
      height: 1080,
      fileSizeBytes: 102400,
      extension: "mp4",
      animated: 1,
    });
  });

  it("extracts file extension correctly", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("640,480,1");

    const result = await getVariantInfo(
      "sticker1",
      "original",
      "/path/to/file.png"
    );

    expect(result.extension).toBe("png");
  });

  it("detects animated media when frameCount > 1", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 200000 } as any);
    vi.mocked(spawn).mockResolvedValue("800,600,120");

    const result = await getVariantInfo(
      "sticker2",
      "thumbnail",
      "/path/to/animated.gif"
    );

    expect(result.animated).toBe(1);
  });

  it("detects static media when frameCount is 1", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 150000 } as any);
    vi.mocked(spawn).mockResolvedValue("1280,720,1");

    const result = await getVariantInfo(
      "sticker3",
      "high",
      "/path/to/image.png"
    );

    expect(result.animated).toBe(0);
  });

  it("throws FFPROBE_ERROR when file doesn't exist", async () => {
    vi.mocked(fsModule.statSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file");
    });

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/nonexistent.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("throws FFPROBE_ERROR when spawn fails", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockRejectedValue(new Error("ffprobe failed"));

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/file.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("throws FFPROBE_ERROR when ffprobe output is invalid", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("invalid,output");

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/file.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("throws FFPROBE_ERROR when width is NaN", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("NaN,1080,60");

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/file.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("throws FFPROBE_ERROR when height is NaN", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("1920,NaN,60");

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/file.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("throws FFPROBE_ERROR when output has too few parts", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("1920");

    await expect(
      getVariantInfo("sticker1", "high", "/path/to/file.mp4")
    ).rejects.toSatisfy((error: any) => error.code === "FFPROBE_ERROR");
  });

  it("handles different variant types", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 75000 } as any);
    vi.mocked(spawn).mockResolvedValue("512,512,1");

    const highResult = await getVariantInfo("s1", "high", "/path/to/file.mp4");
    const thumbResult = await getVariantInfo(
      "s1",
      "thumbnail",
      "/path/to/file.mp4"
    );
    const origResult = await getVariantInfo(
      "s1",
      "original",
      "/path/to/file.mp4"
    );

    expect(highResult.type).toBe("high");
    expect(thumbResult.type).toBe("thumbnail");
    expect(origResult.type).toBe("original");
  });

  it("calls spawn with ffprobe command and correct arguments", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("1920,1080,60");

    await getVariantInfo("sticker1", "high", "/path/to/file.mp4");

    expect(spawn).toHaveBeenCalledWith(
      expect.stringContaining("ffprobe"),
      expect.arrayContaining([
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,nb_read_frames",
        "-count_frames",
        "-of",
        "csv=p=0",
        "/path/to/file.mp4",
      ])
    );
  });

  it("correctly parses frameCount as undefined when missing", async () => {
    vi.mocked(fsModule.statSync).mockReturnValue({ size: 50000 } as any);
    vi.mocked(spawn).mockResolvedValue("1920,1080,");

    const result = await getVariantInfo(
      "sticker1",
      "high",
      "/path/to/file.mp4"
    );

    expect(result.animated).toBe(0);
  });

  it("handles various file sizes", async () => {
    vi.mocked(spawn).mockResolvedValue("640,480,1");

    vi.mocked(fsModule.statSync).mockReturnValue({ size: 1000 } as any);
    const smallFile = await getVariantInfo("s1", "high", "/path/to/small.mp4");

    vi.mocked(fsModule.statSync).mockReturnValue({ size: 1000000000 } as any);
    const largeFile = await getVariantInfo("s1", "high", "/path/to/large.mp4");

    expect(smallFile.fileSizeBytes).toBe(1000);
    expect(largeFile.fileSizeBytes).toBe(1000000000);
  });
});

describe("saveFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully saves a file from response body stream", async () => {
    const responseBody = new EventEmitter();
    const writeStream = new EventEmitter();

    (responseBody as any).pipe = vi.fn().mockReturnValue(writeStream);
    vi.mocked(fsModule.createWriteStream).mockReturnValue(writeStream as any);

    const promise = saveFile("/path/to/file.mp4", responseBody as any);

    // Simulate successful write
    setTimeout(() => {
      writeStream.emit("finish");
    }, 0);

    await promise;

    expect(fsModule.createWriteStream).toHaveBeenCalledWith(
      "/path/to/file.mp4"
    );
  });

  it("pipes response body to write stream", async () => {
    const responseBody = new EventEmitter();
    const writeStream = new EventEmitter();

    const pipeSpy = vi.fn().mockReturnValue(writeStream);
    (responseBody as any).pipe = pipeSpy;

    vi.mocked(fsModule.createWriteStream).mockReturnValue(writeStream as any);

    const promise = saveFile("/path/to/file.mp4", responseBody as any);

    setTimeout(() => {
      writeStream.emit("finish");
    }, 0);

    await promise;

    expect(pipeSpy).toHaveBeenCalledWith(writeStream);
  });

  it("rejects promise when write stream errors", async () => {
    const responseBody = new EventEmitter();
    const writeStream = new EventEmitter();

    (responseBody as any).pipe = vi.fn().mockReturnValue(writeStream);
    vi.mocked(fsModule.createWriteStream).mockReturnValue(writeStream as any);

    const promise = saveFile("/path/to/file.mp4", responseBody as any);

    setTimeout(() => {
      writeStream.emit("error", new Error("Write failed"));
    }, 0);

    await expect(promise).rejects.toThrow("Failed to save file: Write failed");
  });

  it("rejects promise when response body stream errors", async () => {
    const responseBody = new EventEmitter();
    const writeStream = new EventEmitter();

    (responseBody as any).pipe = vi.fn().mockReturnValue(writeStream);
    vi.mocked(fsModule.createWriteStream).mockReturnValue(writeStream as any);

    const promise = saveFile("/path/to/file.mp4", responseBody as any);

    setTimeout(() => {
      responseBody.emit("error", new Error("Stream error"));
    }, 0);

    await expect(promise).rejects.toThrow("Stream error: Stream error");
  });

  it("rejects if write stream error occurs after partial data transfer", async () => {
    const responseBody = new EventEmitter();
    const writeStream = new EventEmitter();

    (responseBody as any).pipe = vi.fn().mockReturnValue(writeStream);
    vi.mocked(fsModule.createWriteStream).mockReturnValue(writeStream as any);

    const promise = saveFile("/path/to/data.zip", responseBody as any);

    setTimeout(() => {
      writeStream.emit("error", new Error("Disk full"));
    }, 5);

    await expect(promise).rejects.toThrow("Failed to save file: Disk full");
  });
});

describe("deleteAllVariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes all variant files for a sticker", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [
      { type: "original" as const, extension: "mp4" },
      { type: "high" as const, extension: "webp" },
      { type: "thumbnail" as const, extension: "webp" },
    ];

    await deleteAllVariants("sticker123", variants);

    expect(fspromisesModule.rm).toHaveBeenCalled();
    // Should be called once for each variant type (high, thumbnail) + once for original
    const calls = vi.mocked(fspromisesModule.rm).mock.calls.length;
    expect(calls).toBe(3);
  });

  it("deletes original file with correct extension", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "original" as const, extension: "png" }];

    await deleteAllVariants("sticker456", variants);

    const calls = vi.mocked(fspromisesModule.rm).mock.calls;
    // Should include call to delete original with .png extension
    const originalCall = calls.find((call) =>
      (call[0] as string).includes("sticker456.png")
    );
    expect(originalCall).toBeDefined();
  });

  it("handles missing original variant gracefully", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "high" as const, extension: "webp" }];

    await deleteAllVariants("sticker789", variants);

    expect(fspromisesModule.rm).toHaveBeenCalled();
    // Should still complete even without original variant
  });

  it("returns promise that resolves when all deletions complete", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "original" as const, extension: "gif" }];

    const result = await deleteAllVariants("sticker999", variants);

    expect(result).toBeUndefined();
  });

  it("passes force: true option to rm calls", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "original" as const, extension: "webp" }];

    await deleteAllVariants("sticker111", variants);

    const calls = vi.mocked(fspromisesModule.rm).mock.calls;
    calls.forEach((call) => {
      expect(call[1]).toEqual({ force: true });
    });
  });

  it("deletes webp files for each variant type", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "original" as const, extension: "mp4" }];

    await deleteAllVariants("sticker222", variants);

    const calls = vi.mocked(fspromisesModule.rm).mock.calls;
    // Should have calls that include "high", "thumbnail" directories with .webp files
    const hasWebpCalls = calls.some((call) =>
      (call[0] as string).includes(".webp")
    );
    expect(hasWebpCalls).toBe(true);
  });

  it("rejects if any rm call fails", async () => {
    const rmError = new Error("Permission denied");
    vi.mocked(fspromisesModule.rm).mockRejectedValueOnce(rmError);

    const variants = [{ type: "original" as const, extension: "mp4" }];

    await expect(deleteAllVariants("sticker444", variants)).rejects.toThrow(
      "Permission denied"
    );
  });

  it("uses ASSETS_DIR_PATH environment variable in paths", async () => {
    vi.mocked(fspromisesModule.rm).mockResolvedValue(undefined);

    const variants = [{ type: "original" as const, extension: "webp" }];

    await deleteAllVariants("sticker555", variants);

    // Verify rm was called (paths should contain ASSETS_DIR_PATH from env)
    expect(
      (vi.mocked(fspromisesModule.rm).mock.calls[0]?.[0] as string)?.includes(
        join(env.ASSETS_DIR_PATH) // Normalize slashes
      )
    ).toBe(true);
  });
});

describe("buildFfmpegArgs", () => {
  it("builds basic args with required parameters only", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    expect(args).toContain("-i");
    expect(args).toContain("/input.mp4");
    expect(args).toContain("-vf");
    expect(args).toContain("-c:v");
    expect(args).toContain("libwebp_anim");
    expect(args).toContain("-loop");
    expect(args).toContain("0");
    expect(args).toContain("-an");
    expect(args).toContain("-pix_fmt");
    expect(args).toContain("bgra");
    expect(args).toContain("-f");
    expect(args).toContain("webp");
    expect(args).toContain("-y");
    expect(args).toContain("/output.webp");
  });

  it("includes scale filter with height parameter", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 720,
    } as any);

    const vfIndex = args.indexOf("-vf");
    const filterChain = args[vfIndex + 1];
    expect(filterChain).toContain("scale=");
    expect(filterChain).toContain("720");
  });

  it("includes frame rate filter when frameRate option provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      frameRate: 30,
    } as any);

    const vfIndex = args.indexOf("-vf");
    const filterChain = args[vfIndex + 1];
    expect(filterChain).toContain("fps=");
    expect(filterChain).toContain("30");
  });

  it("does not include frame rate filter when frameRate not provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    const vfIndex = args.indexOf("-vf");
    const filterChain = args[vfIndex + 1];
    expect(filterChain).not.toContain("fps=");
  });

  it("includes quality parameter when provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      quality: 85,
    } as any);

    expect(args).toContain("-quality");
    expect(args).toContain("85");
  });

  it("does not include quality parameter when not provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    expect(args).not.toContain("-quality");
  });

  it("includes method parameter when provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      method: 4,
    } as any);

    expect(args).toContain("-method");
    expect(args).toContain("4");
  });

  it("does not include method parameter when not provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    expect(args).not.toContain("-method");
  });

  it("includes maxBitrate parameter when provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      maxBitrate: "2M",
    } as any);

    expect(args).toContain("-maxrate");
    expect(args).toContain("2M");
  });

  it("includes bufSize parameter when provided", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      bufSize: "4M",
    } as any);

    expect(args).toContain("-bufsize");
    expect(args).toContain("4M");
  });

  it("includes duration limit parameter", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    expect(args).toContain("-t");
  });

  it("uses force_original_aspect_ratio in scale filter", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    const vfIndex = args.indexOf("-vf");
    const filterChain = args[vfIndex + 1];
    expect(filterChain).toContain("force_original_aspect_ratio=decrease");
  });

  it("properly escapes commas in filter chain", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
      frameRate: 30,
    } as any);

    const vfIndex = args.indexOf("-vf");
    const filterChain = args[vfIndex + 1];
    // Filter chain should have proper escaping for scale and fps separation
    expect(filterChain).toMatch(/scale=.*,fps=/);
  });

  it("includes input before vf filter", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    const inputIndex = args.indexOf("/input.mp4");
    const vfIndex = args.indexOf("-vf");
    expect(inputIndex).toBeLessThan(vfIndex);
  });

  it("specifies webp output path at end", () => {
    const args = buildFfmpegArgs("/input.mp4", "/output.webp", {
      height: 512,
    } as any);

    const outputIndex = args.indexOf("/output.webp");

    expect(outputIndex).toBe(args.length - 1);
  });
});

describe("ffmpeg function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully converts file with temp file management", async () => {
    vi.mocked(miscModule.spawn).mockResolvedValue("");
    vi.mocked(fsModule.renameSync).mockReturnValue(undefined as any);

    await ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any);

    expect(miscModule.spawn).toHaveBeenCalledWith(
      expect.stringContaining("ffmpeg"),
      expect.arrayContaining(["-i", "/input.mp4"])
    );
  });

  it("creates temp file with .part extension", async () => {
    vi.mocked(miscModule.spawn).mockResolvedValue("");
    vi.mocked(fsModule.renameSync).mockReturnValue(undefined as any);

    await ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any);

    const spawnCall = vi.mocked(miscModule.spawn).mock.calls[0]!;
    const args = spawnCall[1] as string[];
    expect(args.at(-1)).toBe("/output.webp.part");
  });

  it("renames temp file to output path on success", async () => {
    vi.mocked(miscModule.spawn).mockResolvedValue("");
    vi.mocked(fsModule.renameSync).mockReturnValue(undefined as any);

    await ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any);

    expect(fsModule.renameSync).toHaveBeenCalledWith(
      "/output.webp.part",
      "/output.webp"
    );
  });

  it("cleans up temp file on ffmpeg error", async () => {
    vi.mocked(miscModule.spawn).mockRejectedValue(new Error("ffmpeg failed"));
    vi.mocked(fsModule.rmSync).mockReturnValue(undefined as any);

    await expect(
      ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any)
    ).rejects.toThrow();

    expect(fsModule.rmSync).toHaveBeenCalledWith(
      "/output.webp.part",
      expect.objectContaining({ force: true })
    );
  });

  it("passes correct arguments to spawn for ffmpeg", async () => {
    vi.mocked(miscModule.spawn).mockResolvedValue("");
    vi.mocked(fsModule.renameSync).mockReturnValue(undefined as any);

    await ffmpeg("/input.mp4", "/output.webp", {
      height: 720,
      frameRate: 30,
      quality: 80,
    } as any);

    const spawnCall = vi.mocked(miscModule.spawn).mock.calls[0]!;
    const args = spawnCall[1] as string[];

    expect(args).toContain("-i");
    expect(args).toContain("/input.mp4");
    expect(args).toContain("-c:v");
    expect(args).toContain("libwebp_anim");
    expect(args).toContain("-quality");
    expect(args).toContain("80");
  });

  it("throws TypedError with FFMPEG_ERROR code on failure", async () => {
    vi.mocked(miscModule.spawn).mockRejectedValue(
      new Error("ffmpeg conversion failed")
    );
    vi.mocked(fsModule.rmSync).mockReturnValue(undefined as any);

    await expect(
      ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any)
    ).rejects.toSatisfy((error: any) => error.code === "FFMPEG_ERROR");
  });

  it("uses FFMPEG_PATH environment variable", async () => {
    vi.mocked(miscModule.spawn).mockResolvedValue("");
    vi.mocked(fsModule.renameSync).mockReturnValue(undefined as any);

    await ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any);

    const spawnCall = vi.mocked(miscModule.spawn).mock.calls[0]!;
    expect((spawnCall[0] as string).includes(env.FFMPEG_PATH)).toBe(true);
  });

  it("does not rename file if spawn fails", async () => {
    vi.mocked(miscModule.spawn).mockRejectedValue(new Error("ffmpeg failed"));
    vi.mocked(fsModule.rmSync).mockReturnValue(undefined as any);

    await expect(
      ffmpeg("/input.mp4", "/output.webp", { height: 512 } as any)
    ).rejects.toThrow();

    expect(fsModule.renameSync).not.toHaveBeenCalled();
  });
});

describe("processWebp with sharp", () => {
  const options = {
    height: 512,
    quality: 80,
    method: 6,
  } as StickerVariantEncodingConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("it throws if input path leads to non webp file", async () => {
    await expect(
      processWebp("input.png", "out.webp", options)
    ).rejects.toBeInstanceOf(miscModule.TypedError);

    await expect(
      processWebp("input.png", "out.webp", options)
    ).rejects.toMatchObject({
      code: "SHARP_ERROR",
    });

    expect(sharp).not.toHaveBeenCalled();
  });

  it("resizes when metadata height is greater than target height", async () => {
    metadataMock.mockResolvedValue({ height: 1024 });
    toFileMock.mockResolvedValue({});

    await processWebp("input.webp", "out.webp", options);

    expect(resizeMock).toHaveBeenCalledWith({
      height: options.height,
      fit: "inside",
    });
  });

  it("does NOT resize when metadata height is within limit", async () => {
    metadataMock.mockResolvedValue({ height: 256 });
    toFileMock.mockResolvedValue({});

    await processWebp("input.webp", "out.webp", options);

    expect(resizeMock).not.toHaveBeenCalled();
  });

  it("encodes webp with correct options", async () => {
    metadataMock.mockResolvedValue({ height: 1024 });
    toFileMock.mockResolvedValue({});

    await processWebp("input.webp", "out.webp", options);

    expect(webpMock).toHaveBeenCalledWith({
      effort: options.method,
      quality: options.quality,
    });

    expect(toFileMock).toHaveBeenCalledWith("out.webp");
  });
});
