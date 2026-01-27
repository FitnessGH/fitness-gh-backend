import { z } from "zod";

// Gender enum validation
const GenderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);

// Update profile validation schema (all fields optional)
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
  avatarUrl: z
    .string()
    .url("Invalid avatar URL format")
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

// Profile ID validation
export const userIdSchema = z.object({
  id: z
    .string()
    .min(1, "Profile ID is required")
    .regex(/^\w+$/, "Invalid profile ID format"),
});

// Type inference for validation schemas
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SearchUserInput = z.infer<typeof searchUserSchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
