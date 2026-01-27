// Export controller for external use
export { default as GymController } from "./controllers/gym.controller.js";

// Export the main route for the gyms module
export { default as gymRoute } from "./routes/gym.route.js";

// Export service for external use
export { default as GymService } from "./services/gym.service.js";

// Export types for external use
export type {
  CreateEmploymentData,
  CreateGymData,
  EmployeeResponse,
  GymResponse,
  GymWithOwner,
  UpdateEmploymentData,
  UpdateGymData,
} from "./types/gym.types.js";

// Export validation schemas for external use
export {
  addEmployeeSchema,
  createGymSchema,
  employeeIdSchema,
  gymIdSchema,
  gymSlugSchema,
  updateEmployeeSchema,
  updateGymSchema,
} from "./validations/gym.validation.js";
