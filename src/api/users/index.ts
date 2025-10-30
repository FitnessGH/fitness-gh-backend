// Export controller for external use (if needed)
export { default as UserController } from "./controllers/user.controller.js";

// Export the main route for the users module
export { default as userRoute } from "./routes/user.route.js";

// Export service for external use (if needed)
export { default as UserService } from "./services/user.service.js";

// Export types for external use
export type {
  CreateUserData,
  UpdateUserData,
  UserResponse,
  UserStatsResponse,
} from "./types/user.types.js";

// Export validation schemas for external use
export {
  createUserSchema,
  searchUserSchema,
  updateUserSchema,
  userIdSchema,
} from "./validations/user.validation.js";
