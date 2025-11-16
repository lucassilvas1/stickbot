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

export function treatString(string: string) {
  // Escape apostrophes (single quotes), otherwise FTS5 will throw
  return string.replaceAll("'", '"\'"').toLowerCase().trim().normalize("NFC");
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
      reject(new Error("stdin error: ", error));
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
  private timeoutIds = new Map<K, NodeJS.Timeout>();
  private expirationMs;

  constructor(expirationMs: number) {
    this.expirationMs = expirationMs;
  }

  private resetTimeout(key: K) {
    clearTimeout(this.timeoutIds.get(key));
    this.timeoutIds.set(
      key,
      setTimeout(() => this.cache.delete(key), this.expirationMs)
    );
  }

  set(key: K, value: V) {
    this.cache.set(key, value);
    this.resetTimeout(key);
  }

  get(key: K) {
    this.resetTimeout(key);
    return this.cache.get(key);
  }

  delete(key: K) {
    clearTimeout(this.timeoutIds.get(key));
    this.timeoutIds.delete(key);
    this.cache.delete(key);
  }

  clear() {
    this.timeoutIds.forEach(clearTimeout);
    this.timeoutIds.clear();
    this.cache.clear();
  }
}
