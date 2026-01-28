/* eslint-disable node/no-process-env */
import { ValiError, minLength, number, object, optional, picklist, pipe, string, transform, parse } from "valibot";

// Default secrets for development/test (DO NOT use in production!)
const DEV_SECRET = "development-only-secret-key-min-32-characters-long";

const envSchema = object({
  NODE_ENV: optional(picklist(["development", "production", "test"]), "development"),
  PORT: optional(pipe(
    string(),
    transform(value => Number(value)),
    number(),
  ), 5001),
  DATABASE_URL: pipe(
    string(),
    minLength(1, "DATABASE_URL is required"),
  ),
  DIRECT_DATABASE_URL: optional(string()),

  // JWT Configuration (required in production, defaults in dev/test)
  JWT_ACCESS_SECRET: optional(string(), DEV_SECRET),
  JWT_REFRESH_SECRET: optional(string(), DEV_SECRET),
  JWT_ACCESS_EXPIRY: optional(string(), "15m"),
  JWT_REFRESH_EXPIRY: optional(string(), "7d"),
});

function parseEnv() {
  try {
    return parse(envSchema, process.env);
  }
  catch (error) {
    if (error instanceof ValiError) {
      console.error("Missing environment variables:", error.issues.map(issue => issue.path));
    }
    else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Export the validated env object for convenient access
export const env = parseEnv();

// A configuration object to hold validated environment variables
const config = {
  env: process.env,
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,

  // JWT settings
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtAccessExpiry: env.JWT_ACCESS_EXPIRY,
  jwtRefreshExpiry: env.JWT_REFRESH_EXPIRY,
};

// Make the configuration object available to the entire application code
export default config;
