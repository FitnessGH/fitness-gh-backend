import { z } from "zod";

// Duration unit enum
const DurationUnitEnum = z.enum(["DAYS", "WEEKS", "MONTHS", "YEARS"]);

// Membership status enum
const MembershipStatusEnum = z.enum(["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"]);

// ========================================
// SUBSCRIPTION PLAN VALIDATIONS
// ========================================

// Create plan validation schema
export const createPlanSchema = z.object({
  name: z
    .string()
    .min(2, "Plan name must be at least 2 characters")
    .max(100, "Plan name must not exceed 100 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100000, "Price must not exceed 100,000"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
  duration: z
    .number()
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1")
    .max(365, "Duration must not exceed 365"),
  durationUnit: DurationUnitEnum,
  features: z
    .array(z.string())
    .optional(),
  maxVisits: z
    .number()
    .int("Max visits must be a whole number")
    .min(1, "Max visits must be at least 1")
    .optional(),
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0)
    .optional(),
});

// Update plan validation schema
export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Plan ID validation
export const planIdSchema = z.object({
  planId: z
    .string()
    .min(1, "Plan ID is required"),
});

// ========================================
// MEMBERSHIP VALIDATIONS
// ========================================

// Create membership validation schema
export const createMembershipSchema = z.object({
  planId: z
    .string()
    .min(1, "Plan ID is required"),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  autoRenew: z
    .boolean()
    .default(false),
});

// Create membership by staff (includes email lookup)
export const createMembershipByStaffSchema = z.object({
  email: z
    .string()
    .email("Invalid email format"),
  planId: z
    .string()
    .min(1, "Plan ID is required"),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
  autoRenew: z
    .boolean()
    .default(false),
});

// Update membership validation schema
export const updateMembershipSchema = z.object({
  status: MembershipStatusEnum.optional(),
  autoRenew: z.boolean().optional(),
  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => val ? new Date(val) : undefined),
});

// Membership ID validation
export const membershipIdSchema = z.object({
  membershipId: z
    .string()
    .min(1, "Membership ID is required"),
});

// Type inference
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
export type CreateMembershipByStaffInput = z.infer<typeof createMembershipByStaffSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
