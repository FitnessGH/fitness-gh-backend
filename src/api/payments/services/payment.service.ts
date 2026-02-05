import { randomBytes } from "crypto";

import { prisma } from "../../core/services/prisma.service.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import SubscriptionService from "../../subscriptions/services/subscription.service.js";

import type { InitiatePaymentData, PaymentResponse, VerifyPaymentResponse, WebhookEvent } from "../types/payment.types.js";

class PaymentService {
  /**
   * Simulate initiating a payment
   */
  async initiatePayment(data: InitiatePaymentData): Promise<PaymentResponse> {
    // Generate a reference
    const reference = `REF-${randomBytes(4).toString("hex").toUpperCase()}-${Date.now()}`;
    
    // Simulate provider URL (in a real app, this comes from Paystack/Stripe)
    const authorizationUrl = `https://checkout.simulated-pay.com/${reference}?amount=${data.amount}`;

    const payment = await prisma.payment.create({
      data: {
        profileId: data.profileId,
        gymId: data.gymId,
        membershipId: data.membershipId,
        amount: data.amount,
        currency: data.currency || "GHS",
        reference,
        provider: "SIMULATOR",
        channel: data.channel || "mobile_money",
        status: "PENDING",
      },
    });

    return {
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      authorizationUrl,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Verify payment status
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new NotFoundError({ message: "Payment reference not found" });
    }

    return {
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
    };
  }

  /**
   * Simulate a webhook event (to act as callback handling)
   * In a real app, this would verify signature from provider
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    if (event.event === "charge.success") {
      const { reference } = event.data;
      
      const payment = await prisma.payment.findUnique({
        where: { reference },
      });

      if (!payment) {
        // Log error but don't throw to avoid 500 to webhook caller
        console.error(`Webhook error: Payment ${reference} not found`);
        return;
      }

      if (payment.status !== "COMPLETED") {
        // Update payment status
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            paidAt: new Date(),
          },
        });

        // If linked to membership, activate it
        if (payment.membershipId) {
          await SubscriptionService.activateMembership(payment.membershipId, payment.id);
        }
      }
    }
  }

  /**
   * Get user payments
   */
  async getUserPayments(profileId: string) {
    return await prisma.payment.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      include: {
        gym: { select: { name: true } },
        membership: {
          include: {
            plan: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * Get gym payments (for owners)
   */
  async getGymPayments(gymId: string) {
    return await prisma.payment.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
      include: {
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        membership: {
          include: {
            plan: { select: { name: true } },
          },
        },
      },
    });
  }
}

export default new PaymentService();
