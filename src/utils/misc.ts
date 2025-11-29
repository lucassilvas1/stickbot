import type { TypedErrorCode } from "../types/misc.js";
import { spawn as _spawn, type SpawnOptionsWithoutStdio } from "child_process";

/**
 * Generates a random alphanumeric ID (case insensitive)
 * @param length The length of the ID to generate. Defaults to 12
 * @returns A random alphanumeric string
 */
export function generateId(length: number = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

export function getNonLNZCharSet(string: string) {
  // Match any single code point NOT in categories L*, N*, Z*
  const regex = /[^\p{L}\p{N}\p{Z}]/gu;
  return Array.from(new Set(string.match(regex) ?? []));
}

export function sanitizeString(string: string) {
  // Escape apostrophes (single quotes), otherwise FTS5 will throw
  // Colons are used as separators for the search cache
  return (
    string
      // Remove characters that could interfere with FTS5 parsing
      .replace(/["(){}:<>^~*\-_]/g, "")
      // Replace double spaces and apostrophes with single spaces
      .replace(/'/g, " ")
      .replace(/\s{2,}/g, " ")
      .toLowerCase()
      .trim()
      .normalize("NFC")
  );
}

export function findString(
  text: string,
  prefix: string,
  suffix: string
): string | null {
  const startIndex = text.indexOf(prefix);
  if (startIndex === -1) return null;

  const from = startIndex + prefix.length;
  const endIndex = text.indexOf(suffix, from);
  if (endIndex === -1) return null;

  return text.slice(from, endIndex);
}

export function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<string> {
  const process = _spawn(command, args, options);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} failed with code ${code}: ${stderr}`));
      } else resolve(stdout);
    });

    process.on("error", (error) => {
      reject(new Error(`Failed to run ${command}: ${error}`));
    });

    process.stdin.on("error", (error) => {
      reject(new Error("stdin error: " + error));
    });
  });
}

export class TypedError extends Error {
  readonly code: TypedErrorCode;

  constructor(
    code: TypedErrorCode,
    options: { cause?: unknown; message?: string } = {}
  ) {
    super(options.message, { cause: options.cause });
    this.name = "TypedError";
    this.code = code;
  }
}

export class Cache<K extends PropertyKey, V> {
  private cache = new Map<K, V>();
  private timers = new Map<K, NodeJS.Timeout>();
  constructor(private expirationMs: number, private maxSize?: number) {}

  private clearIfOverLimit() {
    if (!this.maxSize) return;
    while (this.cache.size > this.maxSize) {
      // evict oldest
      const oldestKey = this.cache.keys().next().value;
      this.delete(oldestKey!);
    }
  }

  private resetTimer(key: K) {
    const prev = this.timers.get(key);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, this.expirationMs);
    this.timers.set(key, t);
  }

  set(key: K, value: V) {
    this.cache.set(key, value);
    this.resetTimer(key);
    this.clearIfOverLimit();
  }

  get(key: K): V | undefined {
    const v = this.cache.get(key);
    if (v !== undefined) {
      this.resetTimer(key);
      return v;
    }
  }

  delete(key: K) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
    this.cache.delete(key);
  }

  clear() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.cache.clear();
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}
