import z = require("zod");

export const envSchema = z.object({
  OWNER_USER_ID: z.string(),
  BOT_TOKEN: z.string(),
  APPLICATION_ID: z.string(),
  GUILD_ID: z.string(),
});

export type Env = z.infer<typeof envSchema>;
