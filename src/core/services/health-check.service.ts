import PrismaService from "./prisma.service.js";

class HealthCheckService {
  static async checkServiceHealth() {
    const timestamp = new Date().toISOString();

    try {
      // Check database connectivity
      const isDatabaseHealthy = await PrismaService.healthCheck();

      return {
        status: isDatabaseHealthy ? "Healthy" : "Degraded",
        timestamp,
        details: {
          service: "up",
          database: isDatabaseHealthy ? "Connected" : "Connection failed",
        },
      };
    }
    catch (error) {
      console.error("Health check error:", error);

      const serviceDownError = {
        status: "Unhealthy",
        timestamp,
        details: {
          service: "down",
          database: "Unable to connect to the database.",
        },
      };
      throw serviceDownError;
    }
  }
}

export default HealthCheckService;
