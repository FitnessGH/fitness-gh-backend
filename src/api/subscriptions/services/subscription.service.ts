import type { DurationUnit, MembershipStatus, SubscriptionPlan, Membership } from "@prisma/client";

import { prisma } from "@/core/services/prisma.service.js";
import { ConflictError, NotFoundError } from "@/errors";

import type {
  CreateMembershipData,
  CreatePlanData,
  MembershipResponse,
  MembershipWithPlan,
  PlanResponse,
  UpdateMembershipData,
  UpdatePlanData,
} from "../types/subscription.types.js";

class SubscriptionService {
  // ========================================
  // SUBSCRIPTION PLAN OPERATIONS
  // ========================================

  /**
   * Create a new subscription plan
   */
  async createPlan(gymId: string, data: CreatePlanData): Promise<SubscriptionPlan> {
    return await prisma.subscriptionPlan.create({
      data: {
        gymId,
        ...data,
      },
    });
  }

  /**
   * Get all plans for a gym
   */
  async getGymPlans(gymId: string, options?: { activeOnly?: boolean }): Promise<PlanResponse[]> {
    return await prisma.subscriptionPlan.findMany({
      where: {
        gymId,
        ...(options?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    return await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
  }

  /**
   * Update plan
   */
  async updatePlan(planId: string, data: UpdatePlanData): Promise<SubscriptionPlan> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new NotFoundError({ message: "Subscription plan not found" });
    }

    return await prisma.subscriptionPlan.update({
      where: { id: planId },
      data,
    });
  }

  /**
   * Soft delete plan (set isActive to false)
   */
  async deletePlan(planId: string): Promise<void> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new NotFoundError({ message: "Subscription plan not found" });
    }

    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });
  }

  // ========================================
  // MEMBERSHIP OPERATIONS
  // ========================================

  /**
   * Create a new membership
   */
  async createMembership(data: CreateMembershipData): Promise<MembershipWithPlan> {
    // Check if plan exists
    const plan = await this.getPlanById(data.planId);
    if (!plan) {
      throw new NotFoundError({ message: "Subscription plan not found" });
    }

    // Check if profile already has an active membership for this gym+plan
    const existingMembership = await prisma.membership.findFirst({
      where: {
        profileId: data.profileId,
        gymId: data.gymId,
        planId: data.planId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
    });

    if (existingMembership) {
      throw new ConflictError({ message: "User already has an active membership for this plan" });
    }

    // Calculate end date based on plan duration
    const startDate = data.startDate || new Date();
    const endDate = this.calculateEndDate(startDate, plan.duration, plan.durationUnit);

    return await prisma.membership.create({
      data: {
        profileId: data.profileId,
        gymId: data.gymId,
        planId: data.planId,
        startDate,
        endDate,
        autoRenew: data.autoRenew ?? false,
        status: "PENDING", // Will be set to ACTIVE after payment
      },
      include: { plan: true },
    });
  }

  /**
   * Create membership by staff (find profile by email)
   */
  async createMembershipByEmail(
    gymId: string,
    email: string,
    planId: string,
    options?: { startDate?: Date; autoRenew?: boolean },
  ): Promise<MembershipWithPlan> {
    const account = await prisma.account.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!account || !account.profile) {
      throw new NotFoundError({ message: "No user found with this email" });
    }

    return await this.createMembership({
      profileId: account.profile.id,
      gymId,
      planId,
      startDate: options?.startDate,
      autoRenew: options?.autoRenew,
    });
  }

  /**
   * Get membership by ID with plan info
   */
  async getMembershipById(membershipId: string): Promise<MembershipWithPlan | null> {
    return await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { plan: true },
    });
  }

  /**
   * Get all memberships for a gym
   */
  async getGymMemberships(
    gymId: string,
    options?: { status?: MembershipStatus },
  ): Promise<MembershipResponse[]> {
    const memberships = await prisma.membership.findMany({
      where: {
        gymId,
        ...(options?.status ? { status: options.status } : {}),
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            durationUnit: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return memberships.map((m) => ({
      id: m.id,
      profileId: m.profileId,
      gymId: m.gymId,
      planId: m.planId,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
      autoRenew: m.autoRenew,
      visitsUsed: m.visitsUsed,
      createdAt: m.createdAt,
      profile: m.profile,
      plan: m.plan,
    }));
  }

  /**
   * Get user's memberships across all gyms
   */
  async getUserMemberships(profileId: string): Promise<MembershipWithPlan[]> {
    return await prisma.membership.findMany({
      where: { profileId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update membership
   */
  async updateMembership(membershipId: string, data: UpdateMembershipData): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundError({ message: "Membership not found" });
    }

    // If cancelling, set cancelledAt
    const updateData: UpdateMembershipData & { cancelledAt?: Date } = { ...data };
    if (data.status === "CANCELLED") {
      updateData.cancelledAt = new Date();
    }

    return await prisma.membership.update({
      where: { id: membershipId },
      data: updateData,
    });
  }

  /**
   * Activate membership (typically after payment)
   */
  async activateMembership(membershipId: string, paymentId?: string): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { plan: true },
    });

    if (!membership) {
      throw new NotFoundError({ message: "Membership not found" });
    }

    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, membership.plan.duration, membership.plan.durationUnit);

    return await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: "ACTIVE",
        startDate,
        endDate,
        lastPaymentId: paymentId,
      },
    });
  }

  /**
   * Cancel membership
   */
  async cancelMembership(membershipId: string): Promise<void> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundError({ message: "Membership not found" });
    }

    await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        autoRenew: false,
      },
    });
  }

  /**
   * Increment visit count for a membership
   */
  async recordVisit(membershipId: string): Promise<Membership> {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { plan: true },
    });

    if (!membership) {
      throw new NotFoundError({ message: "Membership not found" });
    }

    // Check if membership is active
    if (membership.status !== "ACTIVE") {
      throw new ConflictError({ message: "Membership is not active" });
    }

    // Check if expired
    if (membership.endDate && membership.endDate < new Date()) {
      throw new ConflictError({ message: "Membership has expired" });
    }

    // Check if max visits reached
    if (membership.plan.maxVisits && membership.visitsUsed >= membership.plan.maxVisits) {
      throw new ConflictError({ message: "Maximum visits reached for this membership" });
    }

    return await prisma.membership.update({
      where: { id: membershipId },
      data: { visitsUsed: { increment: 1 } },
    });
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private calculateEndDate(startDate: Date, duration: number, unit: DurationUnit): Date {
    const endDate = new Date(startDate);

    switch (unit) {
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
}

export default new SubscriptionService();
