import * as dotenv from "dotenv";
import { envSchema } from "./types/env.js";

// Load base environment variables first
dotenv.config({ path: ".env" });

// Load environment-specific variables (these will override base variables)
const environment = process.env.NODE_ENV || "development";
const envFile = environment === "production" ? ".env.prod" : ".env.dev";

const envResult = dotenv.config({ path: envFile, override: true });
if (envResult.error) {
  throw new Error(
    `Failed to load env file "${envFile}": ${envResult.error.message}`
  );
}

export const env = envSchema.parse(process.env);
