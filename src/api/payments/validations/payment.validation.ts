import type { InferOutput } from "valibot";

import {

  minLength,
  object,
  optional,
  picklist,
  pipe,
  record,
  strictObject,
  string,
  unknown,
} from "valibot";

// Initiate payment schema
export const initiatePaymentSchema = strictObject({
  membershipId: pipe(
    string(),
    minLength(1, "Membership ID is required"),
  ),
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
