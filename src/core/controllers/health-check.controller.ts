import type { Request, Response } from "express";

import HealthCheckService from "@/core/services/health-check.service";

class HealthCheckController {
  static async getHealthStatus(_req: Request, res: Response) {
    try {
      const healthStatus = await HealthCheckService.checkServiceHealth();
      res.status(200).json(healthStatus);
    }
    catch (error) {
      res.status(503).json(error);
    }
  }
}

export default HealthCheckController;
