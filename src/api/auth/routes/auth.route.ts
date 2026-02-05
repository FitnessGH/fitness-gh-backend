import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

import AuthController from "../controllers/auth.controller.js";

class AuthRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Public routes
    this.post("/register", AuthController.register);
    this.post("/login", AuthController.login);
    this.post("/refresh", AuthController.refresh);
    this.post("/logout", AuthController.logout);
    
    // OTP routes
    this.post("/send-otp", AuthController.sendOTP);
    this.post("/verify-otp", AuthController.verifyOTP);

    // Protected routes (require authentication)
    this.get("/me", authenticate, AuthController.me);
    this.post("/logout-all", authenticate, AuthController.logoutAll);
    this.post("/change-password", authenticate, AuthController.changePassword);
  }
}

export default new AuthRoute().getRouter();
