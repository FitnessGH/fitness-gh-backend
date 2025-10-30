import { BaseRoute } from "@/core/base-route";

import UserController from "../controllers/user.controller.js";

class UserRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Basic CRUD operations
    this.get("/", UserController.getUsers);
    this.get("/search", UserController.searchUsers); // Must come before /:id
    this.get("/stats", UserController.getUserStats); // Must come before /:id
    this.get("/:id", UserController.getUserById);
    this.post("/", UserController.createUser);
    this.put("/:id", UserController.updateUser);
    this.delete("/:id", UserController.deleteUser);
  }
}

export default new UserRoute().getRouter();
