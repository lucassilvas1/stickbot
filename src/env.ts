import * as dotenv from "dotenv";
import { envSchema } from "./types/env.js";

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || "development";
const envFile = environment === "production" ? ".env.prod" : ".env.dev";

const result = dotenv.config({ path: envFile });
if (result.error) {
  throw new Error(
    `Failed to load env file "${envFile}": ${result.error.message}`
  );
}

export const env = envSchema.parse(process.env);
