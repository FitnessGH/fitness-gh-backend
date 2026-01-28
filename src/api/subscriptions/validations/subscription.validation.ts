import {
  array,
  boolean,
  email,
  integer,
  isoDateTime,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  transform,
  type InferOutput,
} from "valibot";

// Duration unit enum
const DurationUnitEnum = picklist(["DAYS", "WEEKS", "MONTHS", "YEARS"]);

// Membership status enum
const MembershipStatusEnum = picklist(["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"]);

// ========================================
// SUBSCRIPTION PLAN VALIDATIONS
// ========================================

// Create plan validation schema
export const createPlanSchema = object({
  name: pipe(
    string(),
    minLength(2, "Plan name must be at least 2 characters"),
    maxLength(100, "Plan name must not exceed 100 characters"),
  ),
  description: optional(pipe(
    string(),
    maxLength(500, "Description must not exceed 500 characters"),
  )),
  price: pipe(
    number(),
    minValue(0, "Price cannot be negative"),
    maxValue(100000, "Price must not exceed 100,000"),
  ),
  currency: optional(pipe(
    string(),
    minLength(3, "Currency must be a 3-letter code"),
    maxLength(3, "Currency must be a 3-letter code"),
  ), "GHS"),
  duration: pipe(
    number(),
    integer("Duration must be a whole number"),
    minValue(1, "Duration must be at least 1"),
    maxValue(365, "Duration must not exceed 365"),
  ),
  durationUnit: DurationUnitEnum,
  features: optional(array(string())),
  maxVisits: optional(pipe(
    number(),
    integer("Max visits must be a whole number"),
    minValue(1, "Max visits must be at least 1"),
  )),
  sortOrder: optional(pipe(
    number(),
    integer("Sort order must be a whole number"),
    minValue(0),
  )),
});

// Update plan validation schema
export const updatePlanSchema = object({
  name: optional(pipe(
    string(),
    minLength(2, "Plan name must be at least 2 characters"),
    maxLength(100, "Plan name must not exceed 100 characters"),
  )),
  description: optional(pipe(
    string(),
    maxLength(500, "Description must not exceed 500 characters"),
  )),
  price: optional(pipe(
    number(),
    minValue(0, "Price cannot be negative"),
    maxValue(100000, "Price must not exceed 100,000"),
  )),
  currency: optional(pipe(
    string(),
    minLength(3, "Currency must be a 3-letter code"),
    maxLength(3, "Currency must be a 3-letter code"),
  )),
  duration: optional(pipe(
    number(),
    integer("Duration must be a whole number"),
    minValue(1, "Duration must be at least 1"),
    maxValue(365, "Duration must not exceed 365"),
  )),
  durationUnit: optional(DurationUnitEnum),
  features: optional(array(string())),
  maxVisits: optional(pipe(
    number(),
    integer("Max visits must be a whole number"),
    minValue(1, "Max visits must be at least 1"),
  )),
  sortOrder: optional(pipe(
    number(),
    integer("Sort order must be a whole number"),
    minValue(0),
  )),
  isActive: optional(boolean()),
});

// Plan ID validation
export const planIdSchema = object({
  planId: pipe(
    string(),
    minLength(1, "Plan ID is required"),
  ),
});

// ========================================
// MEMBERSHIP VALIDATIONS
// ========================================

// Create membership validation schema
export const createMembershipSchema = object({
  planId: pipe(
    string(),
    minLength(1, "Plan ID is required"),
  ),
  startDate: optional(pipe(
    string(),
    isoDateTime(),
    transform(value => new Date(value)),
  )),
  autoRenew: optional(boolean(), false),
});

// Create membership by staff (includes email lookup)
export const createMembershipByStaffSchema = object({
  email: pipe(
    string(),
    email("Invalid email format"),
  ),
  planId: pipe(
    string(),
    minLength(1, "Plan ID is required"),
  ),
  startDate: optional(pipe(
    string(),
    isoDateTime(),
    transform(value => new Date(value)),
  )),
  autoRenew: optional(boolean(), false),
});

// Update membership validation schema
export const updateMembershipSchema = object({
  status: optional(MembershipStatusEnum),
  autoRenew: optional(boolean()),
  endDate: optional(pipe(
    string(),
    isoDateTime(),
    transform(value => new Date(value)),
  )),
});

// Membership ID validation
export const membershipIdSchema = object({
  membershipId: pipe(
    string(),
    minLength(1, "Membership ID is required"),
  ),
});

// Type inference
export type CreatePlanInput = InferOutput<typeof createPlanSchema>;
export type UpdatePlanInput = InferOutput<typeof updatePlanSchema>;
export type CreateMembershipInput = InferOutput<typeof createMembershipSchema>;
export type CreateMembershipByStaffInput = InferOutput<typeof createMembershipByStaffSchema>;
export type UpdateMembershipInput = InferOutput<typeof updateMembershipSchema>;
