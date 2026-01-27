import type { Gender, Prisma, UserProfile } from "@prisma/client";

export type CreateProfileData = {
  accountId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: Gender;
};

export type UpdateProfileData = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: Gender;
  preferences?: Prisma.InputJsonValue;
};

export type ProfileResponse = {
  id: string;
  accountId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  height: number | null;
  weight: number | null;
  age: number | null;
  gender: Gender | null;
};

export type ProfileStatsResponse = {
  totalProfiles: number;
  timestamp: string;
};

export type { UserProfile };
