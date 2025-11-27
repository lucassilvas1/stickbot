import * as dotenv from "dotenv";
import { envSchema } from "./types/env.js";

// Load base environment variables first
dotenv.config({ path: ".env" });

const envFileMap = {
  test: ".env.test",
  development: ".env.dev",
  production: ".env.prod",
} as const;

// Load environment-specific variables (these will override base variables)
const environment = process.env.NODE_ENV || "development";
if (!(environment in envFileMap)) {
  throw new Error(`Unexpected NODE_ENV value: ${environment}`);
}
const envFile = envFileMap[environment as keyof typeof envFileMap];

const envResult = dotenv.config({ path: envFile, override: true });
if (envResult.error) {
  throw new Error(
    `Failed to load env file "${envFile}": ${envResult.error.message}`
  );
}

export const env = envSchema.parse(process.env);
