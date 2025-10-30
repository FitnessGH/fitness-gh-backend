/* eslint-disable node/no-process-env */
import { z } from "zod/v4";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().optional(),
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
};

// Make the configuration object available to the entire application code
export default config;
