// Export controller for external use
export { default as AuthController } from "./controllers/auth.controller.js";

// Export the main route for the auth module
export { default as authRoute } from "./routes/auth.route.js";

// Export service for external use
export { default as AuthService } from "./services/auth.service.js";

// Export types for external use
export type {
  AuthResponse,
  AuthTokens,
  LoginData,
  ProfileWithAccount,
  RegisterData,
  SafeAccount,
} from "./types/auth.types.js";

// Export validation schemas for external use
export {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from "./validations/auth.validation.js";
