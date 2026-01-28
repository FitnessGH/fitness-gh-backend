import {
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  regex,
  string,
  url,
  type InferOutput,
} from "valibot";

// Gender enum validation
const GenderEnum = picklist(["MALE", "FEMALE", "OTHER"]);

// Update profile validation schema (all fields optional)
export const updateUserSchema = object({
  firstName: optional(pipe(
    string(),
    minLength(1, "First name cannot be empty"),
    maxLength(100, "First name must not exceed 100 characters"),
  )),
  lastName: optional(pipe(
    string(),
    minLength(1, "Last name cannot be empty"),
    maxLength(100, "Last name must not exceed 100 characters"),
  )),
  avatarUrl: optional(pipe(
    string(),
    url("Invalid avatar URL format"),
  )),
  height: optional(pipe(
    number(),
    minValue(50, "Height must be at least 50cm"),
    maxValue(300, "Height must not exceed 300cm"),
  )),
  weight: optional(pipe(
    number(),
    minValue(20, "Weight must be at least 20kg"),
    maxValue(500, "Weight must not exceed 500kg"),
  )),
  age: optional(pipe(
    number(),
    integer("Age must be a whole number"),
    minValue(13, "Age must be at least 13"),
    maxValue(120, "Age must not exceed 120"),
  )),
  gender: optional(GenderEnum),
});

// Search query validation
export const searchUserSchema = object({
  q: pipe(
    string(),
    minLength(1, "Search query cannot be empty"),
    maxLength(100, "Search query must not exceed 100 characters"),
  ),
});

// Profile ID validation
export const userIdSchema = object({
  id: pipe(
    string(),
    minLength(1, "Profile ID is required"),
    regex(/^\w+$/, "Invalid profile ID format"),
  ),
});

// Type inference for validation schemas
export type UpdateUserInput = InferOutput<typeof updateUserSchema>;
export type SearchUserInput = InferOutput<typeof searchUserSchema>;
export type UserIdInput = InferOutput<typeof userIdSchema>;
