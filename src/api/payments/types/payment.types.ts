import type { Payment, PaymentStatus } from "@prisma/client";

export type InitiatePaymentData = {
  profileId: string;
  gymId: string;
  membershipId?: string;
  amount: number;
  currency?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentResponse = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  authorizationUrl?: string; // For redirecting user to pay
  createdAt: Date;
  updatedAt: Date;
};

export type VerifyPaymentResponse = {
  id: string;
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt: Date | null;
  receiptNumber?: string;
};

export type WebhookEvent = {
  event: string; // e.g., "charge.success"
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, unknown>;
  };
};

export type { Payment, PaymentStatus };
