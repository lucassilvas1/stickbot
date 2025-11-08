import z = require("zod");

export const envSchema = z.object({
  BOT_TOKEN: z.string(),
});

export type Env = z.infer<typeof envSchema>;
