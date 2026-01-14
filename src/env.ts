import * as dotenv from "dotenv";
import { envSchema } from "./types/env.js";

// Load base environment variables first
dotenv.config({ path: ".env" });

const envFileMap = {
  test: ".env.dev",
  development: ".env.dev",
  production: ".env.prod",
} as const;

// Load environment-specific variables (these will override base variables)
const environment = process.env.NODE_ENV || "development";
if (!(environment in envFileMap)) {
  throw new Error(`Unexpected NODE_ENV value: ${environment}`);
}
const envFile = envFileMap[environment as keyof typeof envFileMap];

dotenv.config({ path: envFile, override: true });

export const env = envSchema.parse(process.env);

if (env.LOG_TO_CONSOLE === undefined) {
  env.LOG_TO_CONSOLE = process.env.NODE_ENV === "development";
}
