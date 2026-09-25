import type { UserProfile } from "@prisma/client";

import type { ProfileResponse, UpdateProfileData } from "../types/user.types.js";

import { prisma } from "../../../core/services/prisma.service.js";

class UserService {
  /**
   * Get all user profiles with selected fields
   */
  static async getAllProfiles(): Promise<ProfileResponse[]> {
    return await prisma.userProfile.findMany({
      select: {
        id: true,
        accountId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get all users with account information (for admin)
   */
  static async getAllUsersWithAccounts() {
    return await prisma.account.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        userType: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get profile by ID. Archived profiles are treated as not found.
   */
  static async getProfileById(id: string): Promise<UserProfile | null> {
    const profile = await prisma.userProfile.findUnique({
      where: { id },
    });

    return profile?.archivedAt ? null : profile;
  }

  /**
   * Get profile by account ID
   */
  static async getProfileByAccountId(accountId: string): Promise<UserProfile | null> {
    return await prisma.userProfile.findUnique({
      where: { accountId },
    });
  }

  /**
   * Get profile by username
   */
  static async getProfileByUsername(username: string): Promise<UserProfile | null> {
    return await prisma.userProfile.findUnique({
      where: { username },
    });
  }

  /**
   * Update profile by ID
   */
  static async updateProfile(id: string, profileData: UpdateProfileData): Promise<UserProfile> {
    // Business logic: Check if profile exists
    const existingProfile = await this.getProfileById(id);
    if (!existingProfile) {
      throw new Error("Profile not found");
    }

    return await prisma.userProfile.update({
      where: { id },
      data: profileData,
    });
  }

  /**
   * Soft-delete profile by ID (archives; never a hard delete)
   */
  static async deleteProfile(id: string): Promise<void> {
    // Business logic: Check if profile exists
    const existingProfile = await this.getProfileById(id);
    if (!existingProfile) {
      throw new Error("Profile not found");
    }

    await prisma.userProfile.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Get profile count (for analytics/admin purposes)
   */
  static async getProfileCount(): Promise<number> {
    return await prisma.userProfile.count();
  }

  /**
   * Search profiles by name or username
   */
  static async searchProfiles(query: string): Promise<ProfileResponse[]> {
    return await prisma.userProfile.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        accountId: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
        createdAt: true,
      },
    });
  }
}

export default UserService;
