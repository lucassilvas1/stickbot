import z = require("zod");
import { logLevelParser } from "./misc.js";
import { stickerSearchOrderParser } from "./stickers.js";

const booleanParser = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

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
  LOG_LEVEL: logLevelParser.default("info"),
  LOG_DIR_PATH: z.string().optional(),
  LOG_TO_CONSOLE: booleanParser.optional(),
  AUTOCOMPLETE_ORDER_BY: stickerSearchOrderParser.default("usage.count"),
});

export type Env = z.infer<typeof envSchema>;
