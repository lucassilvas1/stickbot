import pino from "pino";
import { env } from "./env.js";
import { join } from "path";

const targets = [];
if (env.LOG_DIR_PATH) {
  targets.push({
    target: "pino/file",
    options: { destination: join(env.LOG_DIR_PATH, "app.log"), mkdir: true },
  });
}
if (env.LOG_TO_CONSOLE) {
  targets.push({
    target: "pino-pretty",
    options: { colorize: true, translateTime: "HH:MM:ss" },
  });
}

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    formatters: {
      bindings: (bindings) => {
        return { pid: bindings.pid, host: bindings.hostname };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.transport({ targets })
);
