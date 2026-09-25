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

  // SMTP (email delivery falls back to a mock/logging service when unset)
  SMTP_SERVER: optional(string(), "smtp-relay.brevo.com"),
  SMTP_PORT: optional(string(), "587"),
  SMTP_USER: optional(string()),
  SMTP_PASS: optional(string()),

  // Vercel Blob storage token for uploads
  BLOB_READ_WRITE_TOKEN: optional(string()),
});

function parseEnv() {
  try {
    const parsedEnv = parse(envSchema, process.env);

    if (parsedEnv.NODE_ENV === "production") {
      if (parsedEnv.JWT_ACCESS_SECRET === DEV_SECRET || parsedEnv.JWT_ACCESS_SECRET.length < 32) {
        throw new Error("JWT_ACCESS_SECRET must be configured with at least 32 characters in production");
      }

      if (parsedEnv.JWT_REFRESH_SECRET === DEV_SECRET || parsedEnv.JWT_REFRESH_SECRET.length < 32) {
        throw new Error("JWT_REFRESH_SECRET must be configured with at least 32 characters in production");
      }

      if (parsedEnv.JWT_ACCESS_SECRET === parsedEnv.JWT_REFRESH_SECRET) {
        throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production");
      }
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
  nodeEnv: env.NODE_ENV,
  port: env.PORT ?? 5001,
  databaseUrl: env.DATABASE_URL,

  // JWT settings
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtAccessExpiry: env.JWT_ACCESS_EXPIRY,
  jwtRefreshExpiry: env.JWT_REFRESH_EXPIRY,
  corsOrigin: env.CORS_ORIGIN,
};

// Make the configuration object available to the entire application code
export default config;
