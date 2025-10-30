import type { User } from "@prisma/client";

import { prisma } from "@/core/services/prisma.service.js";

import type { CreateUserData, UpdateUserData, UserResponse } from "../types/user.types.js";

class UserService {
  /**
   * Get all users with selected fields
   */
  static async getAllUsers(): Promise<UserResponse[]> {
    return await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
      },
    });
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Check if user exists by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Check if user exists by username
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Create a new user
   */
  static async createUser(userData: CreateUserData): Promise<User> {
    // Business logic: Validate unique constraints
    const existingUserByEmail = await this.getUserByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error("A user with this email already exists");
    }

    const existingUserByUsername = await this.getUserByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error("A user with this username already exists");
    }

    return await prisma.user.create({
      data: userData,
    });
  }

  /**
   * Update user by ID
   */
  static async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    // Business logic: Check if user exists
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new Error("User not found");
    }

    return await prisma.user.update({
      where: { id },
      data: userData,
    });
  }

  /**
   * Delete user by ID
   */
  static async deleteUser(id: string): Promise<void> {
    // Business logic: Check if user exists
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new Error("User not found");
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Get user count (for analytics/admin purposes)
   */
  static async getUserCount(): Promise<number> {
    return await prisma.user.count();
  }

  /**
   * Search users by name or username
   */
  static async searchUsers(query: string): Promise<UserResponse[]> {
    return await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        height: true,
        weight: true,
        age: true,
        gender: true,
      },
    });
  }
}

export default UserService;
