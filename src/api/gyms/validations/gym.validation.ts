import { z } from "zod";

// Slug validation (URL-friendly string)
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Operating hours schema
const operatingHoursSchema = z.object({
  monday: z.object({ open: z.string(), close: z.string() }).optional(),
  tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
  wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
  thursday: z.object({ open: z.string(), close: z.string() }).optional(),
  friday: z.object({ open: z.string(), close: z.string() }).optional(),
  saturday: z.object({ open: z.string(), close: z.string() }).optional(),
  sunday: z.object({ open: z.string(), close: z.string() }).optional(),
}).optional();

// Create gym validation schema
export const createGymSchema = z.object({
  name: z
    .string()
    .min(2, "Gym name must be at least 2 characters")
    .max(100, "Gym name must not exceed 100 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must not exceed 100 characters")
    .regex(slugRegex, "Slug must be lowercase with hyphens only (e.g., 'my-gym')"),
  description: z
    .string()
    .max(1000, "Description must not exceed 1000 characters")
    .optional(),
  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address must not exceed 200 characters"),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must not exceed 100 characters"),
  region: z
    .string()
    .min(2, "Region must be at least 2 characters")
    .max(100, "Region must not exceed 100 characters"),
  country: z
    .string()
    .min(2, "Country must be at least 2 characters")
    .max(100, "Country must not exceed 100 characters")
    .default("Ghana"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s-]+$/, "Invalid phone number format")
    .optional(),
  email: z
    .string()
    .email("Invalid email format")
    .optional(),
  website: z
    .string()
    .url("Invalid website URL")
    .optional(),
  logoUrl: z
    .string()
    .url("Invalid logo URL")
    .optional(),
  coverUrl: z
    .string()
    .url("Invalid cover URL")
    .optional(),
  operatingHours: operatingHoursSchema,
});

// Update gym validation schema (all fields optional)
export const updateGymSchema = createGymSchema.partial().omit({ slug: true });

// Gym ID/slug validation
export const gymIdSchema = z.object({
  id: z
    .string()
    .min(1, "Gym ID is required"),
});

export const gymSlugSchema = z.object({
  slug: z
    .string()
    .min(1, "Gym slug is required")
    .regex(slugRegex, "Invalid slug format"),
});

// Employee role enum
const EmployeeRoleEnum = z.enum(["MANAGER", "TRAINER", "RECEPTIONIST", "STAFF"]);

// Add employee validation schema
export const addEmployeeSchema = z.object({
  email: z
    .string()
    .email("Invalid email format"),
  role: EmployeeRoleEnum,
});

// Update employee validation schema
export const updateEmployeeSchema = z.object({
  role: EmployeeRoleEnum.optional(),
  isActive: z.boolean().optional(),
});

// Employee ID param validation
export const employeeIdSchema = z.object({
  employeeId: z
    .string()
    .min(1, "Employee ID is required"),
});

// Type inference
export type CreateGymInput = z.infer<typeof createGymSchema>;
export type UpdateGymInput = z.infer<typeof updateGymSchema>;
export type AddEmployeeInput = z.infer<typeof addEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
