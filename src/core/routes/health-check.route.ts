import { BaseRoute } from "@/core/base-route";
import HealthCheckController from "@/core/controllers/health-check.controller";

class HealthCheckRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/health", HealthCheckController.getHealthStatus);
  }
}

export default new HealthCheckRoute().getRouter();
