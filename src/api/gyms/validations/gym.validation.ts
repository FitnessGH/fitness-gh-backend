import {
  boolean,
  email,
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

// Slug validation (URL-friendly string)
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Operating hours schema
const operatingHoursSchema = optional(object({
  monday: optional(object({ open: string(), close: string() })),
  tuesday: optional(object({ open: string(), close: string() })),
  wednesday: optional(object({ open: string(), close: string() })),
  thursday: optional(object({ open: string(), close: string() })),
  friday: optional(object({ open: string(), close: string() })),
  saturday: optional(object({ open: string(), close: string() })),
  sunday: optional(object({ open: string(), close: string() })),
}));

// Create gym validation schema
export const createGymSchema = object({
  name: pipe(
    string(),
    minLength(2, "Gym name must be at least 2 characters"),
    maxLength(100, "Gym name must not exceed 100 characters"),
  ),
  slug: pipe(
    string(),
    minLength(2, "Slug must be at least 2 characters"),
    maxLength(100, "Slug must not exceed 100 characters"),
    regex(slugRegex, "Slug must be lowercase with hyphens only (e.g., 'my-gym')"),
  ),
  description: optional(pipe(
    string(),
    maxLength(1000, "Description must not exceed 1000 characters"),
  )),
  address: pipe(
    string(),
    minLength(5, "Address must be at least 5 characters"),
    maxLength(200, "Address must not exceed 200 characters"),
  ),
  city: pipe(
    string(),
    minLength(2, "City must be at least 2 characters"),
    maxLength(100, "City must not exceed 100 characters"),
  ),
  region: pipe(
    string(),
    minLength(2, "Region must be at least 2 characters"),
    maxLength(100, "Region must not exceed 100 characters"),
  ),
  country: optional(pipe(
    string(),
    minLength(2, "Country must be at least 2 characters"),
    maxLength(100, "Country must not exceed 100 characters"),
  ), "Ghana"),
  latitude: optional(pipe(
    number(),
    minValue(-90, "Latitude must be between -90 and 90"),
    maxValue(90, "Latitude must be between -90 and 90"),
  )),
  longitude: optional(pipe(
    number(),
    minValue(-180, "Longitude must be between -180 and 180"),
    maxValue(180, "Longitude must be between -180 and 180"),
  )),
  phone: optional(pipe(
    string(),
    regex(/^\+?[\d\s-]+$/, "Invalid phone number format"),
  )),
  email: pipe(
    string(),
    minLength(1, "Email is required"),
    email("Invalid email format"),
  ),
  website: optional(pipe(
    string(),
    url("Invalid website URL"),
  )),
  logoUrl: optional(pipe(
    string(),
    url("Invalid logo URL"),
  )),
  coverUrl: optional(pipe(
    string(),
    url("Invalid cover URL"),
  )),
  operatingHours: operatingHoursSchema,
});

// Update gym validation schema (all fields optional)
export const updateGymSchema = object({
  name: optional(pipe(
    string(),
    minLength(2, "Gym name must be at least 2 characters"),
    maxLength(100, "Gym name must not exceed 100 characters"),
  )),
  description: optional(pipe(
    string(),
    maxLength(1000, "Description must not exceed 1000 characters"),
  )),
  address: optional(pipe(
    string(),
    minLength(5, "Address must be at least 5 characters"),
    maxLength(200, "Address must not exceed 200 characters"),
  )),
  city: optional(pipe(
    string(),
    minLength(2, "City must be at least 2 characters"),
    maxLength(100, "City must not exceed 100 characters"),
  )),
  region: optional(pipe(
    string(),
    minLength(2, "Region must be at least 2 characters"),
    maxLength(100, "Region must not exceed 100 characters"),
  )),
  country: optional(pipe(
    string(),
    minLength(2, "Country must be at least 2 characters"),
    maxLength(100, "Country must not exceed 100 characters"),
  )),
  latitude: optional(pipe(
    number(),
    minValue(-90, "Latitude must be between -90 and 90"),
    maxValue(90, "Latitude must be between -90 and 90"),
  )),
  longitude: optional(pipe(
    number(),
    minValue(-180, "Longitude must be between -180 and 180"),
    maxValue(180, "Longitude must be between -180 and 180"),
  )),
  phone: optional(pipe(
    string(),
    regex(/^\+?[\d\s-]+$/, "Invalid phone number format"),
  )),
  email: optional(pipe(
    string(),
    email("Invalid email format"),
  )),
  website: optional(pipe(
    string(),
    url("Invalid website URL"),
  )),
  logoUrl: optional(pipe(
    string(),
    url("Invalid logo URL"),
  )),
  coverUrl: optional(pipe(
    string(),
    url("Invalid cover URL"),
  )),
  operatingHours: operatingHoursSchema,
});

// Gym ID/slug validation
export const gymIdSchema = object({
  id: pipe(
    string(),
    minLength(1, "Gym ID is required"),
  ),
});

export const gymSlugSchema = object({
  slug: pipe(
    string(),
    minLength(1, "Gym slug is required"),
    regex(slugRegex, "Invalid slug format"),
  ),
});

// Employee role enum
const EmployeeRoleEnum = picklist(["MANAGER", "TRAINER", "RECEPTIONIST", "STAFF"]);

// Add employee validation schema
export const addEmployeeSchema = object({
  email: pipe(
    string(),
    email("Invalid email format"),
  ),
  role: EmployeeRoleEnum,
});

// Update employee validation schema
export const updateEmployeeSchema = object({
  role: optional(EmployeeRoleEnum),
  isActive: optional(boolean()),
});

// Employee ID param validation
export const employeeIdSchema = object({
  employeeId: pipe(
    string(),
    minLength(1, "Employee ID is required"),
  ),
});

// Type inference
export type CreateGymInput = InferOutput<typeof createGymSchema>;
export type UpdateGymInput = InferOutput<typeof updateGymSchema>;
export type AddEmployeeInput = InferOutput<typeof addEmployeeSchema>;
export type UpdateEmployeeInput = InferOutput<typeof updateEmployeeSchema>;
