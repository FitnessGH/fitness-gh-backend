import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import PaymentController from "../controllers/payment.controller.js";

class PaymentRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public Webhook (Simulated)
    this.post("/webhook", PaymentController.webhook);

    // Protected Routes
    this.post("/initiate", authenticate, PaymentController.initiate);
    this.get("/verify/:reference", authenticate, PaymentController.verify);
    this.get("/my", authenticate, PaymentController.getMyPayments);
    
    // Gym Payments (Owner/Manager)
    this.get("/gyms/:id", authenticate, PaymentController.getGymPayments);
  }
}

export default new PaymentRoute().getRouter();
