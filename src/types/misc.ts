import z from "zod";

export type TypedErrorCode =
  | "HTTP"
  | "TOO_LARGE"
  | "INVALID_TYPE"
  | "PROCESSING_ERROR"
  | "FFPROBE_ERROR"
  | "FFMPEG_ERROR"
  | "SHARP_ERROR";

export const logLevelParser = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace"])
  .default("info");

export type LogLevel = z.infer<typeof logLevelParser>;
