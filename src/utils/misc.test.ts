import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  Cache,
  findString,
  generateId,
  getNonLNZCharSet,
  sanitizeString,
  TypedError,
} from "./misc.js";
import { EventEmitter } from "events";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("ID generator", () => {
  it("returns a random string of specified length", () => {
    expect(generateId(10).length).toBe(10);
  });

  it("uses default length of 12 when no argument is provided", () => {
    expect(generateId().length).toBe(12);
  });

  it("generates only alphanumeric lowercase characters", () => {
    const id = generateId(100);
    expect(/^[a-z0-9]+$/.test(id)).toBe(true);
  });

  it("generates different IDs on multiple calls", () => {
    const id1 = generateId(20);
    const id2 = generateId(20);
    const id3 = generateId(20);

    // Statistically impossible for 3 random IDs of length 20 to be identical
    expect(new Set([id1, id2, id3]).size).toBe(3);
  });
});

describe("Unicode non-LNZ character extractor", () => {
  it("returns empty array when only L, N, and Z category chars are present", () => {
    const SPACE = "\u0020"; // Zs
    const NBSP = "\u00A0"; // Zs
    const OGHAM = "\u1680"; // Zs (Ogham space mark)
    const LSEP = "\u2028"; // Zl (line separator)
    const PSEP = "\u2029"; // Zp (paragraph separator)

    const input = [
      "a", // Letter (L)
      "5", // Number (N)
      SPACE,
      NBSP,
      OGHAM,
      LSEP,
      PSEP,
    ].join("");

    // None of these should be returned
    expect(getNonLNZCharSet(input)).toEqual([]);
  });

  it("returns control characters such as LF and CR (not Z category)", () => {
    const LF = "\u000A"; // control, Cc
    const CR = "\u000D"; // control, Cc

    const input = "a" + LF + "b" + CR + "c";

    // Both LF and CR must be returned
    expect(getNonLNZCharSet(input)).toEqual([LF, CR]);
  });

  it("handles combining marks (non-LNZ)", () => {
    const COMBINING_ACUTE = String.fromCodePoint(0x0301); // Mn (mark, nonspacing)
    const input = "a" + COMBINING_ACUTE + " e" + COMBINING_ACUTE;

    expect(getNonLNZCharSet(input)).toEqual([COMBINING_ACUTE]);
  });

  it("extracts other symbols/punctuation correctly (non-LNZ)", () => {
    const input = "abc✨—•🚀123";
    // Letters and numbers ignored, symbols returned
    expect(getNonLNZCharSet(input)).toEqual(["✨", "—", "•", "🚀"]);
  });
});

describe("string sanitizer", () => {
  it("removes problematic characters and normalizes the string", () => {
    expect(sanitizeString(`  {<~Hél-lo^}: _ ("W''or'ld*")>  `)).toBe(
      "héllo w or ld"
    );
  });

  it("replaces apostrophes with a single space", () => {
    expect(sanitizeString("don''t")).toBe("don t");
  });

  it("collapses multiple spaces into a single space", () => {
    expect(sanitizeString("foo    bar")).toBe("foo bar");
  });

  it("lowercases the string", () => {
    expect(sanitizeString("HeLLo")).toBe("hello");
  });

  it("normalizes unicode characters to NFC", () => {
    const decomposed = "e\u0301"; // 'é' in NFD form
    expect(sanitizeString(decomposed)).toBe("é");
  });

  it("returns an empty string when everything is stripped", () => {
    expect(sanitizeString(`{}<>~`)).toBe("");
  });
});

describe("string finder", () => {
  it("extracts text found between the given prefix and suffix", () => {
    expect(findString("foo bar baz", "foo ", " baz")).toBe("bar");
  });

  it("returns null if the prefix can't be found", () => {
    expect(findString("foo bar baz", "abc ", " baz")).toBe(null);
  });

  it("returns null if the suffix can't be found", () => {
    expect(findString("foo bar baz", "foo ", " def")).toBe(null);
  });

  it("extracts the first match when multiple instances of the prefix and suffix exist", () => {
    expect(findString("foo X baz foo Y baz", "foo ", " baz")).toBe("X");
  });

  it("returns null if the suffix appears before the prefix", () => {
    expect(findString("baz foo bar", "foo ", "baz")).toBe(null);
  });

  it("returns an empty string when prefix and suffix are adjacent", () => {
    expect(findString("foo baz", "foo ", "baz")).toBe("");
  });

  it("extracts the text between the first and second occurrence when prefix and suffix are the same", () => {
    expect(findString("baz foo baz", "baz", "baz")).toBe(" foo ");
  });
});

describe("child process spawn wrapper", () => {
  let spawn: any;
  let spawnWrapper: any;

  beforeAll(async () => {
    ({ spawn } = await import("child_process"));
    ({ spawn: spawnWrapper } = await import("./misc.js"));
  });

  function mockProcess() {
    const proc: any = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = new EventEmitter();
    proc.kill = vi.fn();
    return proc;
  }

  it("passes command, args and options to child_process.spawn", async () => {
    const proc = mockProcess();
    spawn.mockReturnValue(proc);

    const promise = spawnWrapper("echo", ["a", "b"], { cwd: "/tmp" });

    proc.emit("close", 0);

    await promise;

    expect(spawn).toHaveBeenCalledWith("echo", ["a", "b"], { cwd: "/tmp" });
  });

  it("resolves with stdout when exit code is 0", async () => {
    const proc = mockProcess();
    (spawn as Mock).mockReturnValue(proc);

    const promise = spawnWrapper("echo");

    proc.stdout.emit("data", Buffer.from("hello "));
    proc.stdout.emit("data", Buffer.from("world"));
    proc.emit("close", 0);

    await expect(promise).resolves.toBe("hello world");
  });

  it("rejects with stderr when exit code is non-zero", async () => {
    const proc = mockProcess();
    (spawn as Mock).mockReturnValue(proc);

    const promise = spawnWrapper("badcmd");

    proc.stderr.emit("data", Buffer.from("fail "));
    proc.stderr.emit("data", Buffer.from("hard"));
    proc.emit("close", 1);

    await expect(promise).rejects.toThrow(
      "badcmd failed with code 1: fail hard"
    );
  });

  it("rejects on process 'error' event", async () => {
    const proc = mockProcess();
    (spawn as Mock).mockReturnValue(proc);

    const promise = spawnWrapper("cmd");

    proc.emit("error", new Error("boom"));

    await expect(promise).rejects.toThrow("Failed to run cmd: Error: boom");
  });

  it("rejects on stdin error", async () => {
    const proc = mockProcess();
    (spawn as Mock).mockReturnValue(proc);

    const promise = spawnWrapper("cmd");

    proc.stdin.emit("error", new Error("stdin broken"));

    await expect(promise).rejects.toThrow("stdin error: Error: stdin broken");
  });
});

describe("cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const c = new Cache<string, number>(1000);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("expires values after the timeout", () => {
    const c = new Cache<string, number>(1000);
    c.set("a", 1);
    vi.advanceTimersByTime(1000);
    expect(c.get("a")).toBeUndefined();
  });

  it("resets the expiration timer on get()", () => {
    const c = new Cache<string, number>(1000);
    c.set("a", 1);

    vi.advanceTimersByTime(900);
    expect(c.get("a")).toBe(1); // access should reset timer

    vi.advanceTimersByTime(900);
    expect(c.get("a")).toBe(1); // should still exist

    vi.advanceTimersByTime(1000);
    expect(c.get("a")).toBeUndefined(); // now it expires
  });

  it("evicts oldest entry when maxSize is exceeded", () => {
    const c = new Cache<string, number>(1000, 2);

    c.set("a", 1); // oldest
    c.set("b", 2);
    c.set("c", 3); // should evict "a"

    expect([...c.entries()]).toEqual([
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("delete() removes value and clears timer", () => {
    const c = new Cache<string, number>(1000);
    c.set("a", 1);

    c.delete("a");

    vi.advanceTimersByTime(1000);
    expect(c.get("a")).toBeUndefined();
  });

  it("clear() empties all entries and clears all timers", () => {
    const c = new Cache<string, number>(1000);
    c.set("a", 1);
    c.set("b", 2);
    c.clear();

    vi.advanceTimersByTime(1000);
    expect([...c.entries()]).toEqual([]);
  });

  it("calls clearTimeout when resetting an existing timer", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    const c = new Cache<string, number>(1000);

    c.set("a", 1); // creates timeout #1
    c.set("a", 2); // should clear timeout #1

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("calls clearTimeout when deleting a key", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    const c = new Cache<string, number>(1000);
    c.set("a", 1);

    c.delete("a"); // should clear its timer

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("calls clearTimeout for all timers when clear() is called", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    const c = new Cache<string, number>(1000);

    c.set("a", 1); // timer 1
    c.set("b", 2); // timer 2
    c.set("c", 3); // timer 3

    c.clear(); // should clear 3 timers

    expect(clearSpy).toHaveBeenCalledTimes(3);
  });

  it("does not evict entries when maxSize is undefined", () => {
    const c = new Cache<string, number>(1000); // no maxSize

    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4);

    expect([...c.entries()].length).toBe(4);
  });

  it("returns undefined for non-existent keys", () => {
    const c = new Cache<string, number>(1000);
    expect(c.get("nonexistent")).toBeUndefined();
  });
});

describe("TypedError", () => {
  it("creates an error with a code and message", () => {
    const error = new TypedError("INVALID_TYPE", {
      message: "Input is invalid",
    });

    expect(error.code).toBe("INVALID_TYPE");
    expect(error.message).toBe("Input is invalid");
    expect(error.name).toBe("TypedError");
  });

  it("creates an error with a code and cause", () => {
    const cause = new Error("Original error");
    const error = new TypedError("PROCESSING_ERROR", { cause });

    expect(error.code).toBe("PROCESSING_ERROR");
    expect(error.cause).toBe(cause);
  });

  it("creates an error with both message and cause", () => {
    const cause = new Error("Original error");
    const error = new TypedError("FFMPEG_ERROR", {
      message: "Something went wrong",
      cause,
    });

    expect(error.code).toBe("FFMPEG_ERROR");
    expect(error.message).toBe("Something went wrong");
    expect(error.cause).toBe(cause);
  });

  it("creates an error with only a code when options are empty", () => {
    const error = new TypedError("HTTP");

    expect(error.code).toBe("HTTP");
    expect(error.message).toBe("");
    expect(error.cause).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const error = new TypedError("TOO_LARGE");
    expect(error instanceof Error).toBe(true);
  });
});
