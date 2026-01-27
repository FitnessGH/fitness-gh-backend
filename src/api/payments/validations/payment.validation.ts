import { z } from "zod";

// Initiate payment schema
export const initiatePaymentSchema = z.object({
  gymId: z
    .string()
    .min(1, "Gym ID is required"),
  membershipId: z
    .string()
    .min(1, "Membership ID is required")
    .optional(),
  amount: z
    .number()
    .positive("Amount must be positive"),
  currency: z
    .string()
    .length(3)
    .default("GHS"),
  channel: z
    .enum(["mobile_money", "card"])
    .optional(),
  metadata: z
    .record(z.unknown())
    .optional(),
});

// Verify payment schema
export const verifyPaymentSchema = z.object({
  reference: z
    .string()
    .min(1, "Payment reference is required"),
});

// Webhook schema (simulated)
export const webhookSchema = z.object({
  event: z.string(),
  data: z.object({
    reference: z.string(),
    status: z.string(),
  }).passthrough(),
});

// Payment ID param
export const paymentIdSchema = z.object({
  paymentId: z
    .string()
    .min(1, "Payment ID is required"),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
