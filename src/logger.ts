import pino from "pino";
import { env } from "./env.js";
import { join } from "path";
import type { LogLevel } from "./types/misc.js";

const targets: any[] = [];
if (env.LOG_DIR_PATH) {
  targets.push({
    target: "pino/file",
    level: "trace",
    options: {
      destination: join(env.LOG_DIR_PATH, "app.log"),
      mkdir: true,
    },
  });
}
if (env.LOG_TO_CONSOLE) {
  targets.push({
    target: "pino-pretty",
    level: "trace",
    options: { colorize: true, translateTime: "HH:MM:ss" },
  });
}

let pinoInstance = createLogger(env.LOG_LEVEL);

function createLogger(level: LogLevel) {
  return pino(
    {
      level: level,
      formatters: {
        bindings: (bindings) => {
          return { pid: bindings.pid, host: bindings.hostname };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport({ targets })
  );
}

export function setLogLevel(level: LogLevel) {
  pinoInstance = createLogger(level);
}

export const logger = new Proxy({} as pino.Logger, {
  get(_target, prop) {
    return (pinoInstance as any)[prop];
  },
});
