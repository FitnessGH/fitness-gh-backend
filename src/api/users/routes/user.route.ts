import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import UserController from "../controllers/user.controller.js";

class UserRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public routes
    this.get("/search", UserController.searchUsers); // Must come before /:id
    this.get("/stats", UserController.getUserStats); // Must come before /:id
    this.get("/:id", UserController.getUserById);

    // Protected routes (require authentication)
    this.get("/", authenticate, UserController.getUsers);
    this.put("/:id", authenticate, UserController.updateUser);
    this.delete("/:id", authenticate, UserController.deleteUser);
  }
}

export default new UserRoute().getRouter();
