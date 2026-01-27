import { BaseRoute } from "@/core/base-route";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { requireGymOwner } from "@/middlewares/rbac.middleware.js";

import GymController from "../controllers/gym.controller.js";

class GymRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public routes
    this.get("/", GymController.listGyms);
    this.get("/:slug", GymController.getGymBySlug);

    // Protected routes - Gym CRUD
    this.get("/my/all", authenticate, GymController.getMyGyms);
    this.post("/", authenticate, requireGymOwner, GymController.createGym);
    this.put("/:id", authenticate, GymController.updateGym);
    this.delete("/:id", authenticate, GymController.deleteGym);

    // Protected routes - Employee management
    this.post("/:id/employees", authenticate, GymController.addEmployee);
    this.get("/:id/employees", authenticate, GymController.listEmployees);
    this.put("/:id/employees/:employeeId", authenticate, GymController.updateEmployee);
    this.delete("/:id/employees/:employeeId", authenticate, GymController.removeEmployee);
  }
}

export default new GymRoute().getRouter();
