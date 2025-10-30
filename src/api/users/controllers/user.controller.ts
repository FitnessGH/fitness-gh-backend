import type { Request, Response } from "express";

import { z } from "zod";

import type { UserStatsResponse } from "../types/user.types.js";

import UserService from "../services/user.service.js";
import {
  createUserSchema,
  searchUserSchema,
  updateUserSchema,
  userIdSchema,
} from "../validations/user.validation.js";

class UserController {
  /**
   * Get all users
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserService.getAllUsers();
      res.json(users);
    }
    catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters
      const { id } = userIdSchema.parse(req.params);

      const user = await UserService.getUserById(id);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(user);
    }
    catch (error) {
      console.error("Error fetching user:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request parameters",
          details: error.errors,
        });
        return;
      }

      res.status(500).json({ error: "Failed to fetch user" });
    }
  }

  /**
   * Create a new user
   */
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const userData = createUserSchema.parse(req.body);

      const user = await UserService.createUser(userData);

      res.status(201).json(user);
    }
    catch (error) {
      console.error("Error creating user:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request data",
          details: error.errors,
        });
        return;
      }

      // Handle business logic errors with specific status codes
      if (error instanceof Error) {
        if (error.message.includes("already exists")) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({ error: "Failed to create user" });
    }
  }

  /**
   * Update user
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters and body
      const { id } = userIdSchema.parse(req.params);
      const userData = updateUserSchema.parse(req.body);

      const user = await UserService.updateUser(id, userData);

      res.json(user);
    }
    catch (error) {
      console.error("Error updating user:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request data",
          details: error.errors,
        });
        return;
      }

      // Handle business logic errors with specific status codes
      if (error instanceof Error && error.message === "User not found") {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "Failed to update user" });
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters
      const { id } = userIdSchema.parse(req.params);

      await UserService.deleteUser(id);
      res.status(204).send();
    }
    catch (error) {
      console.error("Error deleting user:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid request parameters",
          details: error.errors,
        });
        return;
      }

      // Handle business logic errors with specific status codes
      if (error instanceof Error && error.message === "User not found") {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "Failed to delete user" });
    }
  }

  /**
   * Search users
   */
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { q } = searchUserSchema.parse(req.query);

      const users = await UserService.searchUsers(q);
      res.json(users);
    }
    catch (error) {
      console.error("Error searching users:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid search parameters",
          details: error.errors,
        });
        return;
      }

      res.status(500).json({ error: "Failed to search users" });
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const totalUsers = await UserService.getUserCount();

      const stats: UserStatsResponse = {
        totalUsers,
        timestamp: new Date().toISOString(),
      };

      res.json(stats);
    }
    catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user statistics" });
    }
  }
}

export default UserController;
