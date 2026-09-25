import { randomBytes } from "node:crypto";

import type { InitiatePaymentData, PaymentResponse, VerifyPaymentResponse, WebhookEvent } from "../types/payment.types.js";

import { prisma } from "../../../core/services/prisma.service.js";
import { BadRequestError } from "../../../errors/bad-request.error.js";
import { ConflictError } from "../../../errors/conflict.error.js";
import { NotFoundError } from "../../../errors/not-found.error.js";
import { calculateMembershipEndDate } from "../../../utils/membership-duration.util.js";

class PaymentService {
  /**
   * Simulate initiating a payment
   */
  async initiatePayment(data: InitiatePaymentData): Promise<PaymentResponse> {
    return await prisma.$transaction(async (transaction) => {
      const membership = await transaction.membership.findFirst({
        where: {
          id: data.membershipId,
          profileId: data.profileId,
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

      if (membership.status === "ACTIVE") {
        throw new ConflictError({ message: "Membership is already active" });
      }

      if (membership.status !== "PENDING") {
        throw new NotFoundError({ message: "Membership not found" });
      }

      const lockedMembership = await transaction.membership.updateMany({
        where: {
          id: membership.id,
          status: "PENDING",
        },
        data: { updatedAt: new Date() },
      });

      if (lockedMembership.count === 0) {
        const currentMembership = await transaction.membership.findUnique({
          where: { id: membership.id },
          select: { status: true },
        });

        if (currentMembership?.status === "ACTIVE") {
          throw new ConflictError({ message: "Membership is already active" });
        }

        throw new NotFoundError({ message: "Membership not found" });
      }

      if (membership.plan.price <= 0) {
        throw new BadRequestError({ message: "A payment requires a plan with a positive price" });
      }

      const pendingPayment = await transaction.payment.findFirst({
        where: {
          membershipId: membership.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });

      const payment = pendingPayment ?? await transaction.payment.create({
        data: {
          profileId: data.profileId,
          gymId: membership.gymId,
          membershipId: membership.id,
          amount: membership.plan.price,
          currency: membership.plan.currency,
          reference: `REF-${randomBytes(4).toString("hex").toUpperCase()}-${Date.now()}`,
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
        authorizationUrl: `https://checkout.simulated-pay.com/${payment.reference}?amount=${payment.amount}`,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      };
    });
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
      const paidAt = new Date();
      await prisma.$transaction(async (transaction) => {
        const payment = await transaction.payment.findUnique({
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
          throw new BadRequestError({ message: "Payment is not linked to a membership" });
        }

        const startDate = paidAt;
        const endDate = calculateMembershipEndDate(startDate, payment.membership.plan.duration, payment.membership.plan.durationUnit);
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
          const linkedMembership = await transaction.membership.findFirst({
            where: {
              id: payment.membership.id,
              status: "ACTIVE",
              lastPaymentId: payment.id,
            },
          });

          if (!linkedMembership) {
            throw new BadRequestError({ message: "Membership cannot be activated" });
          }
        }
      });
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
