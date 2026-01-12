import z from "zod";

export type FromKeyArray<T extends readonly PropertyKey[], V> = {
  [K in T[number]]: V;
};

export const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

export const logLevelParser = z.enum(logLevels);

export type LogLevel = z.infer<typeof logLevelParser>;
