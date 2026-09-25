import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { requireSuperAdmin } from "../../../middlewares/rbac.middleware.js";
import UserController from "../controllers/user.controller.js";

class UserRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Protected routes (require authentication) - must come before /:id routes
    this.get("/", authenticate, UserController.getUsers);

    // Public routes
    this.get("/search", UserController.searchUsers); // Must come before /:id
    this.get("/stats", UserController.getUserStats); // Must come before /:id

    // Self-service - must come before /:id
    this.patch("/me", authenticate, UserController.updateMe);

    this.get("/:id", UserController.getUserById);

    // SUPER_ADMIN only - cross-account writes
    this.put("/:id", authenticate, requireSuperAdmin, UserController.updateUser);
    this.delete("/:id", authenticate, requireSuperAdmin, UserController.deleteUser);
  }
}

export default new UserRoute().getRouter();
