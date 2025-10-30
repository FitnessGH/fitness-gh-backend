import { z } from "zod";

// Gender enum validation
const GenderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);

// Create user validation schema
export const createUserSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .min(1, "Email is required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .regex(/^\w+$/, "Username can only contain letters, numbers, and underscores"),
  firstName: z
    .string()
    .min(1, "First name cannot be empty")
    .max(100, "First name must not exceed 100 characters")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name cannot be empty")
    .max(100, "Last name must not exceed 100 characters")
    .optional(),
  height: z
    .number()
    .min(50, "Height must be at least 50cm")
    .max(300, "Height must not exceed 300cm")
    .optional(),
  weight: z
    .number()
    .min(20, "Weight must be at least 20kg")
    .max(500, "Weight must not exceed 500kg")
    .optional(),
  age: z
    .number()
    .int("Age must be a whole number")
    .min(13, "Age must be at least 13")
    .max(120, "Age must not exceed 120")
    .optional(),
  gender: GenderEnum.optional(),
});

// Update user validation schema (all fields optional except constraints)
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name cannot be empty")
    .max(100, "First name must not exceed 100 characters")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name cannot be empty")
    .max(100, "Last name must not exceed 100 characters")
    .optional(),
  height: z
    .number()
    .min(50, "Height must be at least 50cm")
    .max(300, "Height must not exceed 300cm")
    .optional(),
  weight: z
    .number()
    .min(20, "Weight must be at least 20kg")
    .max(500, "Weight must not exceed 500kg")
    .optional(),
  age: z
    .number()
    .int("Age must be a whole number")
    .min(13, "Age must be at least 13")
    .max(120, "Age must not exceed 120")
    .optional(),
  gender: GenderEnum.optional(),
});

// Search query validation
export const searchUserSchema = z.object({
  q: z
    .string()
    .min(1, "Search query cannot be empty")
    .max(100, "Search query must not exceed 100 characters"),
});

// User ID validation
export const userIdSchema = z.object({
  id: z
    .string()
    .min(1, "User ID is required")
    .regex(/^\w+$/, "Invalid user ID format"),
});

// Type inference for validation schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SearchUserInput = z.infer<typeof searchUserSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
