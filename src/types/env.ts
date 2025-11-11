import z = require("zod");

export const envSchema = z.object({
  OWNER_USER_ID: z.string(),
  BOT_TOKEN: z.string(),
  APPLICATION_ID: z.string(),
  GUILD_ID: z.string(),
  DB_DIR_PATH: z.string(),
  ASSETS_DIR_PATH: z.string(),
  FFMPEG_PATH: z.string(),
});

export type Env = z.infer<typeof envSchema>;
