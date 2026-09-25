/* eslint-disable node/no-process-env */
import { minLength, number, object, optional, parse, picklist, pipe, string, transform, ValiError } from "valibot";

// Default secrets for development/test (DO NOT use in production!)
const DEV_SECRET = "development-only-secret-key-min-32-characters-long";

const envSchema = object({
  NODE_ENV: optional(picklist(["development", "production", "test"]), "development"),
  PORT: optional(pipe(
    string(),
    transform(value => Number(value)),
    number(),
  )),
  DATABASE_URL: pipe(
    string(),
    minLength(1, "DATABASE_URL is required"),
  ),
  DIRECT_DATABASE_URL: optional(string()),
  CORS_ORIGIN: optional(string()),

  // JWT Configuration (required in production, defaults in dev/test)
  JWT_ACCESS_SECRET: optional(string(), DEV_SECRET),
  JWT_REFRESH_SECRET: optional(string(), DEV_SECRET),
  JWT_ACCESS_EXPIRY: optional(string(), "15m"),
  JWT_REFRESH_EXPIRY: optional(string(), "7d"),
  PAYMENTS_PROVIDER: optional(picklist(["simulator"]), "simulator"),
  PAYMENTS_WEBHOOK_SECRET: optional(string(), DEV_SECRET),
});

function parseEnv() {
  try {
    const parsedEnv = parse(envSchema, process.env);

    if (parsedEnv.NODE_ENV === "production" && parsedEnv.PAYMENTS_PROVIDER === "simulator") {
      throw new Error("PAYMENTS_PROVIDER=simulator cannot be used in production");
    }

    if (parsedEnv.NODE_ENV === "production" && (parsedEnv.PAYMENTS_WEBHOOK_SECRET === DEV_SECRET || parsedEnv.PAYMENTS_WEBHOOK_SECRET.length < 32)) {
      throw new Error("PAYMENTS_WEBHOOK_SECRET must be configured with at least 32 characters in production");
    }

    return parsedEnv;
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
  port: env.PORT ?? 5001,
  databaseUrl: env.DATABASE_URL,

  // JWT settings
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtAccessExpiry: env.JWT_ACCESS_EXPIRY,
  jwtRefreshExpiry: env.JWT_REFRESH_EXPIRY,
  corsOrigin: env.CORS_ORIGIN,
  paymentsProvider: env.PAYMENTS_PROVIDER,
  paymentsWebhookSecret: env.PAYMENTS_WEBHOOK_SECRET,
};

// Make the configuration object available to the entire application code
export default config;
