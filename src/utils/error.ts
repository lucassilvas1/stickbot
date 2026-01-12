import z from "zod";

export type TypedErrorCode =
  | "HTTP"
  | "TOO_LARGE"
  | "INVALID_TYPE"
  | "PROCESSING_ERROR"
  | "FFPROBE_ERROR"
  | "FFMPEG_ERROR"
  | "SHARP_ERROR";

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

const SystemErrorSchema = z.object({
  errno: z.number().optional(),
  code: z.string().optional(),
  syscall: z.string().optional(),
  path: z.string().optional(),
});

export function isSystemError(error: unknown): error is NodeJS.ErrnoException {
  return SystemErrorSchema.safeParse(error).success;
}
