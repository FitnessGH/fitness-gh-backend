import { randomBytes } from "node:crypto";

import type { InitiatePaymentData, PaymentResponse, VerifyPaymentResponse, WebhookEvent } from "../types/payment.types.js";

import { prisma } from "../../../core/services/prisma.service.js";
import { BadRequestError } from "../../../errors/bad-request.error.js";
import { NotFoundError } from "../../../errors/not-found.error.js";

class PaymentService {
  /**
   * Simulate initiating a payment
   */
  async initiatePayment(data: InitiatePaymentData): Promise<PaymentResponse> {
    const membership = await prisma.membership.findFirst({
      where: {
        id: data.membershipId,
        profileId: data.profileId,
        status: "PENDING",
      },
      include: {
        plan: {
          select: {
            price: true,
            currency: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundError({ message: "Membership not found" });
    }

    if (membership.plan.price <= 0) {
      throw new BadRequestError({ message: "A payment requires a plan with a positive price" });
    }

    // Generate a reference
    const reference = `REF-${randomBytes(4).toString("hex").toUpperCase()}-${Date.now()}`;

    // Simulate provider URL (in a real app, this comes from Paystack/Stripe)
    const authorizationUrl = `https://checkout.simulated-pay.com/${reference}?amount=${membership.plan.price}`;

    const payment = await prisma.payment.create({
      data: {
        profileId: data.profileId,
        gymId: membership.gymId,
        membershipId: membership.id,
        amount: membership.plan.price,
        currency: membership.plan.currency,
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
        include: {
          membership: {
            include: { plan: true },
          },
        },
      });

      if (!payment) {
        return;
      }

      const paidAt = new Date();
      await prisma.$transaction(async (transaction) => {
        const completedPayment = await transaction.payment.updateMany({
          where: {
            id: payment.id,
            status: "PENDING",
          },
          data: {
            status: "COMPLETED",
            paidAt,
          },
        });

        if (completedPayment.count === 0) {
          return;
        }

        if (!payment.membership) {
          return;
        }

        const startDate = paidAt;
        const endDate = this.calculateEndDate(startDate, payment.membership.plan.duration, payment.membership.plan.durationUnit);
        const activatedMembership = await transaction.membership.updateMany({
          where: {
            id: payment.membership.id,
            status: "PENDING",
          },
          data: {
            status: "ACTIVE",
            startDate,
            endDate,
            lastPaymentId: payment.id,
          },
        });

        if (activatedMembership.count === 0) {
          await transaction.membership.updateMany({
            where: {
              id: payment.membership.id,
              status: "ACTIVE",
              lastPaymentId: null,
            },
            data: { lastPaymentId: payment.id },
          });
        }
      });
    }
  }

  private calculateEndDate(startDate: Date, duration: number, durationUnit: "DAYS" | "WEEKS" | "MONTHS" | "YEARS"): Date {
    const endDate = new Date(startDate);

    switch (durationUnit) {
      case "DAYS":
        endDate.setDate(endDate.getDate() + duration);
        break;
      case "WEEKS":
        endDate.setDate(endDate.getDate() + duration * 7);
        break;
      case "MONTHS":
        endDate.setMonth(endDate.getMonth() + duration);
        break;
      case "YEARS":
        endDate.setFullYear(endDate.getFullYear() + duration);
        break;
    }

    return endDate;
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
