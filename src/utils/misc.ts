import type { TypedErrorCode } from "../types/misc.js";

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
  return string.toLowerCase().normalize("NFC");
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
