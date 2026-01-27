import type { Account, UserProfile, UserType } from "@prisma/client";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = {
  account: SafeAccount;
  profile: UserProfile | null;
  tokens: AuthTokens;
};

// Account without sensitive fields
export type SafeAccount = Omit<Account, "passwordHash">;

export type RegisterData = {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  userType?: UserType;
};

export type LoginData = {
  email: string;
  password: string;
};

export type ProfileWithAccount = UserProfile & {
  account: SafeAccount;
};

export type AccountWithProfile = Account & {
  profile: UserProfile | null;
};
