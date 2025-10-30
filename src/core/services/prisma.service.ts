import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client Singleton
 * This ensures we have only one instance of PrismaClient throughout the application
 */
class PrismaService {
  private static instance: PrismaClient;

  /**
   * Get the singleton instance of PrismaClient
   */
  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: ["error"],
      });
    }
    return PrismaService.instance;
  }

  /**
   * Connect to the database
   */
  public static async connect(): Promise<void> {
    try {
      const prisma = PrismaService.getInstance();
      await prisma.$connect();
      /* eslint-disable no-console */
      console.log("✅ Database connected successfully");
      /* eslint-enable no-console */
    }
    catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  public static async disconnect(): Promise<void> {
    try {
      const prisma = PrismaService.getInstance();
      await prisma.$disconnect();
      /* eslint-disable no-console */
      console.log("✅ Database disconnected successfully");
      /* eslint-enable no-console */
    }
    catch (error) {
      console.error("❌ Database disconnection failed:", error);
      throw error;
    }
  }

  /**
   * Health check for the database
   */
  public static async healthCheck(): Promise<boolean> {
    try {
      const prisma = PrismaService.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    }
    catch (error) {
      console.error("❌ Database health check failed:", error);
      return false;
    }
  }
}

// Export the singleton instance
export const prisma = PrismaService.getInstance();
export default PrismaService;
