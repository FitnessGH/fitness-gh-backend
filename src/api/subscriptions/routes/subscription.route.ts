import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import SubscriptionController from "../controllers/subscription.controller.js";

class SubscriptionRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // User's own memberships (must come before /:id routes)
    this.get("/memberships/my", authenticate, SubscriptionController.getMyMemberships);

    // Gym-specific plan routes
    this.get("/gyms/:id/plans", SubscriptionController.listPlans);
    this.get("/gyms/:id/plans/:planId", SubscriptionController.getPlan);
    this.post("/gyms/:id/plans", authenticate, SubscriptionController.createPlan);
    this.put("/gyms/:id/plans/:planId", authenticate, SubscriptionController.updatePlan);
    this.delete("/gyms/:id/plans/:planId", authenticate, SubscriptionController.deletePlan);

    // Gym-specific membership routes
    this.get("/gyms/:id/memberships", authenticate, SubscriptionController.listMemberships);
    this.post("/gyms/:id/memberships", authenticate, SubscriptionController.createMembership);
    this.post("/gyms/:id/memberships/self", authenticate, SubscriptionController.selfSubscribe);
    this.put("/gyms/:id/memberships/:membershipId", authenticate, SubscriptionController.updateMembership);
    this.post("/gyms/:id/memberships/:membershipId/activate", authenticate, SubscriptionController.activateMembership);
    this.delete("/gyms/:id/memberships/:membershipId", authenticate, SubscriptionController.cancelMembership);
  }
}

export default new SubscriptionRoute().getRouter();
