import { BaseRoute } from "@/core/base-route";

import { authRoute } from "./auth/index.js";
import { gymRoute } from "./gyms/index.js";
import { subscriptionRoute } from "./subscriptions/index.js";
import { userRoute } from "./users/index.js";

class ApiRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Mount sub-routes
    this.router.use("/auth", authRoute);
    this.router.use("/gyms", gymRoute);
    this.router.use("/subscriptions", subscriptionRoute);
    this.router.use("/users", userRoute);
  }
}

export default new ApiRoute().getRouter();
