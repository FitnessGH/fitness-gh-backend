import type { Account, UserProfile } from "@prisma/client";

import bcrypt from "bcrypt";

import type { Prisma } from "@prisma/client";

import { prisma } from "../../../core/services/prisma.service.js";
import jwtService from "../../../core/services/jwt.service.js";
import { ConflictError } from "../../../errors/conflict.error.js";
import { NotFoundError } from "../../../errors/not-found.error.js";
import { UnauthorizedError } from "../../../errors/unauthorized.error.js";

import type { AuthResponse, AuthTokens, LoginData, RegisterData, SafeAccount } from "../types/auth.types.js";

const SALT_ROUNDS = 12;

class AuthService {
  /**
   * Register a new user account with profile
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Check if email already exists
    const existingEmail = await prisma.account.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new ConflictError({ message: "An account with this email already exists" });
    }

    // Check if username already exists
    const existingUsername = await prisma.userProfile.findUnique({
      where: { username: data.username },
    });
    if (existingUsername) {
      throw new ConflictError({ message: "This username is already taken" });
    }

    // Check if phone already exists (if provided)
    if (data.phone) {
      const existingPhone = await prisma.account.findUnique({
        where: { phone: data.phone },
      });
      if (existingPhone) {
        throw new ConflictError({ message: "An account with this phone number already exists" });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create account and profile in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create account
      const account = await tx.account.create({
        data: {
          email: data.email,
          passwordHash,
          phone: data.phone,
          userType: data.userType || "MEMBER",
        },
      });

      // Create profile
      const profile = await tx.userProfile.create({
        data: {
          accountId: account.id,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      // Handle gym owner registration - create gym record
      if (data.userType === "GYM_OWNER" && data.gymName) {
        await tx.gym.create({
          data: {
            name: data.gymName,
            slug: `${data.gymName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            address: "TBA", // Required field, to be updated later
            city: "TBA",   // Required field, to be updated later
            region: "TBA", // Required field, to be updated later
            ownerId: profile.id,
          },
        });
      }

      // Handle vendor registration - store business name in preferences for now
      if (data.userType === "EMPLOYEE" && data.businessName) {
        await tx.userProfile.update({
          where: { id: profile.id },
          data: {
            preferences: {
              businessName: data.businessName,
            },
          },
        });
      }

      return { account, profile };
    });

    // Generate tokens only after email verification
    const tokens = result.account.emailVerified
      ? this.generateTokens(result.account, result.profile)
      : null;

    if (tokens) {
      await this.storeRefreshToken(result.account.id, tokens.refreshToken);
    }

    if (!result.account.emailVerified) {
      return {
        account: {
          id: result.account.id,
          email: result.account.email,
          userType: result.account.userType,
          emailVerified: result.account.emailVerified,
        },
        profile: null,
        tokens: null,
      };
    }

    return {
      account: this.sanitizeAccount(result.account),
      profile: result.profile,
      tokens,
    };
  }

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    // Find account by email
    const account = await prisma.account.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!account) {
      throw new UnauthorizedError({ message: "Invalid email or password" });
    }

    // Check if account is active
    if (!account.isActive) {
      throw new UnauthorizedError({ message: "This account has been deactivated" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, account.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError({ message: "Invalid email or password" });
    }

    // Update last login time
    await prisma.account.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens(account, account.profile);

    // Store refresh token
    await this.storeRefreshToken(account.id, tokens.refreshToken);

    return {
      account: this.sanitizeAccount(account),
      profile: account.profile,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = jwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedError({ message: "Invalid or expired refresh token" });
    }

    // Check if token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { account: { include: { profile: true } } },
    });

    if (!storedToken || storedToken.revokedAt) {
      throw new UnauthorizedError({ message: "Invalid or revoked refresh token" });
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError({ message: "Refresh token has expired" });
    }

    // Check if account is still active
    if (!storedToken.account.isActive) {
      throw new UnauthorizedError({ message: "Account has been deactivated" });
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new token pair
    const tokens = this.generateTokens(storedToken.account, storedToken.account.profile);

    // Store new refresh token
    await this.storeRefreshToken(storedToken.account.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout by revoking refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Logout from all devices by revoking all refresh tokens
   */
  async logoutAll(accountId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Get account by ID with profile
   */
  async getAccountById(accountId: string): Promise<{ account: SafeAccount; profile: UserProfile | null } | null> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { profile: true },
    });

    if (!account) return null;

    return {
      account: this.sanitizeAccount(account),
      profile: account.profile,
    };
  }

  /**
   * Change password
   */
  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundError({ message: "Account not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError({ message: "Current password is incorrect" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and revoke all refresh tokens
    await prisma.$transaction([
      prisma.account.update({
        where: { id: accountId },
        data: { passwordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ========================================
  // Private helper methods
  // ========================================

  private generateTokens(account: Account, profile: UserProfile | null): AuthTokens {
    return jwtService.generateTokenPair({
      accountId: account.id,
      userType: account.userType,
      profileId: profile?.id,
    });
  }

  private async storeRefreshToken(accountId: string, token: string): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        token,
        accountId,
        expiresAt: jwtService.getRefreshTokenExpiry(),
      },
    });
  }

  private sanitizeAccount(account: Account): SafeAccount {
    const { passwordHash, ...safeAccount } = account;
    return safeAccount;
  }
}

export default new AuthService();
