import { BaseRoute } from "../base-route.js";
import HealthCheckController from "../controllers/health-check.controller.js";

class HealthCheckRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/health", HealthCheckController.getHealthStatus);
  }
}

export default new HealthCheckRoute().getRouter();
