/* eslint-disable node/no-process-env */
import { z } from "zod/v4";

// Default secrets for development/test (DO NOT use in production!)
const DEV_SECRET = "development-only-secret-key-min-32-characters-long";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().optional(),

  // JWT Configuration (required in production, defaults in dev/test)
  JWT_ACCESS_SECRET: z.string().default(DEV_SECRET),
  JWT_REFRESH_SECRET: z.string().default(DEV_SECRET),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
});

function parseEnv() {
  try {
    return envSchema.parse(process.env);
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Missing environment variables:", error.issues.flatMap(issue => issue.path));
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
