import pino from "pino";
import { env } from "./env.js";
import { join } from "path";

let destination;
if (env.LOG_DIR_PATH) {
  destination = pino.destination({
    dest: join(env.LOG_DIR_PATH, "app.log"),
    mkdir: true,
  });
}

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
      bindings: (bindings) => {
        return { pid: bindings.pid, host: bindings.hostname };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  destination
);
