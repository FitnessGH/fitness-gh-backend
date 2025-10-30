import { BaseRoute } from "@/core/base-route";

import { userRoute } from "./users/index.js";

class ApiRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Mount sub-routes
    this.router.use("/users", userRoute);
  }
}

export default new ApiRoute().getRouter();
