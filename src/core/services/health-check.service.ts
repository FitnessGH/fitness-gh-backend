class HealthCheckService {
  static async checkServiceHealth() {
    const timestamp = new Date().toISOString();

    try {
      return {
        status: "Healthy",
        timestamp,
        details: {
          service: "up",
        //   database: "Connection has been established successfully.",
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
        //   database: "Unable to connect to the database.",
        },
      };
      throw serviceDownError;
    }
  }
}

export default HealthCheckService;
