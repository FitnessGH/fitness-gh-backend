import type { EmployeeRole, Gym, Prisma, UserProfile } from "@prisma/client";

export type CreateGymData = {
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  region: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  coverUrl?: string;
  operatingHours?: Prisma.InputJsonValue;
  settings?: Prisma.InputJsonValue;
};

export type UpdateGymData = Partial<Omit<CreateGymData, "slug">>;

export type GymResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  region: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GymResponseWithOwner = GymResponse & {
  owner: Pick<UserProfile, "id" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

export type GymWithOwner = Gym & {
  owner: Pick<UserProfile, "id" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

export type CreateEmploymentData = {
  profileId: string;
  gymId: string;
  role: EmployeeRole;
};

export type UpdateEmploymentData = {
  role?: EmployeeRole;
  isActive?: boolean;
  endDate?: Date;
};

export type EmployeeResponse = {
  id: string;
  profileId: string;
  gymId: string;
  role: EmployeeRole;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  profile: Pick<UserProfile, "id" | "username" | "firstName" | "lastName" | "avatarUrl">;
};

export type { Gym, EmployeeRole };
