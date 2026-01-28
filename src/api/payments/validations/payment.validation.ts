import {
  maxLength,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  record,
  string,
  unknown,
  type InferOutput,
} from "valibot";

// Initiate payment schema
export const initiatePaymentSchema = object({
  gymId: pipe(
    string(),
    minLength(1, "Gym ID is required"),
  ),
  membershipId: optional(pipe(
    string(),
    minLength(1, "Membership ID is required"),
  )),
  amount: pipe(
    number(),
    minValue(0.01, "Amount must be positive"),
  ),
  currency: optional(pipe(
    string(),
    minLength(3),
    maxLength(3),
  ), "GHS"),
  channel: optional(picklist(["mobile_money", "card"])),
  metadata: optional(record(string(), unknown())),
});

// Verify payment schema
export const verifyPaymentSchema = object({
  reference: pipe(
    string(),
    minLength(1, "Payment reference is required"),
  ),
});

// Webhook schema (simulated)
export const webhookSchema = object({
  event: string(),
  data: object({
    reference: string(),
    status: string(),
  }),
});

// Payment ID param
export const paymentIdSchema = object({
  paymentId: pipe(
    string(),
    minLength(1, "Payment ID is required"),
  ),
});

export type InitiatePaymentInput = InferOutput<typeof initiatePaymentSchema>;
export type VerifyPaymentInput = InferOutput<typeof verifyPaymentSchema>;
