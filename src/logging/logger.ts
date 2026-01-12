import pino from "pino";
import { env } from "../env.js";
import { join } from "path";
import type { LogLevel } from "../types/misc.js";
import { setUpLogRotation, stopLogRotation } from "./rotation.js";

const targets: any[] = [];
const logFilePath = env.LOG_DIR_PATH ? join(env.LOG_DIR_PATH, "app.log") : null;

if (env.LOG_DIR_PATH) {
  targets.push({
    target: "pino/file",
    level: "trace",
    options: {
      destination: logFilePath,
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
let rotationInterval: NodeJS.Timeout | null = null;

function createLogger(level: LogLevel) {
  return pino(
    {
      level: level,
      formatters: {
        bindings: () => {
          return {};
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

export async function startLogRotation(
  maxLogAgeDays: number,
  maxLogSizeMB: number,
  maxLogRotations: number,
  rotationCheckIntervalMs = 60 * 60 * 1000
) {
  if (!logFilePath) {
    console.warn("Log rotation requested but LOG_DIR_PATH is not configured");
    return;
  }

  if (rotationInterval) {
    console.warn("Log rotation is already running");
    return;
  }

  rotationInterval = await setUpLogRotation({
    logFilePath,
    maxLogAgeDays,
    maxLogSizeMB,
    maxLogRotations,
    runIntervalMs: rotationCheckIntervalMs,
    onRotate: () => {
      pinoInstance = createLogger(env.LOG_LEVEL);
    },
  });
}

export function stopLogRotationService() {
  if (rotationInterval) {
    stopLogRotation(rotationInterval);
    rotationInterval = null;
  }
}

export const logger = new Proxy({} as pino.Logger, {
  get(_target, prop) {
    return (pinoInstance as any)[prop];
  },
});
