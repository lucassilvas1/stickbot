import z = require("zod");

const booleanParser = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const envSchema = z.object({
  OWNER_USER_ID: z.string(),
  BOT_TOKEN: z.string(),
  APPLICATION_ID: z.string(),
  GUILD_ID: z.string(),
  DB_DIR_PATH: z.string(),
  ASSETS_DIR_PATH: z.string(),
  FFMPEG_PATH: z.string(),
  FFPROBE_PATH: z.string(),
  ASSETS_SERVER_HOSTNAME: z.string(),
  ASSETS_SERVER_PORT: z.string(),
  VERBOSE_LOGGING: booleanParser.default(false),
});

export type Env = z.infer<typeof envSchema>;
