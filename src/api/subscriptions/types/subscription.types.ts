import type { DurationUnit, MembershipStatus, Prisma, SubscriptionPlan, Membership, UserProfile } from "@prisma/client";

// ========================================
// SUBSCRIPTION PLAN TYPES
// ========================================
export type CreatePlanData = {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  duration: number;
  durationUnit: DurationUnit;
  features?: Prisma.InputJsonValue;
  maxVisits?: number;
  sortOrder?: number;
};

export type UpdatePlanData = Partial<CreatePlanData> & {
  isActive?: boolean;
};

export type PlanResponse = {
  id: string;
  gymId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: number;
  durationUnit: DurationUnit;
  features: Prisma.JsonValue;
  maxVisits: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

// ========================================
// MEMBERSHIP TYPES
// ========================================
export type CreateMembershipData = {
  profileId: string;
  gymId: string;
  planId: string;
  startDate?: Date;
  autoRenew?: boolean;
};

export type UpdateMembershipData = {
  status?: MembershipStatus;
  autoRenew?: boolean;
  endDate?: Date;
};

export type MembershipResponse = {
  id: string;
  profileId: string;
  gymId: string;
  planId: string;
  status: MembershipStatus;
  startDate: Date | null;
  endDate: Date | null;
  autoRenew: boolean;
  visitsUsed: number;
  createdAt: Date;
  profile: Pick<UserProfile, "id" | "username" | "firstName" | "lastName" | "avatarUrl">;
  plan: Pick<SubscriptionPlan, "id" | "name" | "price" | "duration" | "durationUnit">;
};

export type MembershipWithPlan = Membership & {
  plan: SubscriptionPlan;
};

export type { SubscriptionPlan, Membership, DurationUnit, MembershipStatus };
