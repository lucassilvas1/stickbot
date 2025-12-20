import z = require("zod");
import { logLevelParser } from "./misc.js";

export const envSchema = z.object({
  BOT_TOKEN: z.string(),
  APPLICATION_ID: z.string(),
  GUILD_ID: z.string(),
  DB_DIR_PATH: z.string(),
  ASSETS_DIR_PATH: z.string(),
  FFMPEG_PATH: z.string(),
  FFPROBE_PATH: z.string(),
  ASSETS_SERVER_HOSTNAME: z.string(),
  ASSETS_SERVER_PORT: z.string(),
  LOG_LEVEL: logLevelParser,
  LOG_DIR_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
