import type { Gender, User } from "@prisma/client";

export type CreateUserData = {
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: Gender;
};

export type UpdateUserData = {
  firstName?: string;
  lastName?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: Gender;
};

export type UserResponse = {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  height: number | null;
  weight: number | null;
  age: number | null;
  gender: Gender | null;
};

export type UserStatsResponse = {
  totalUsers: number;
  timestamp: string;
};

export type { User };
