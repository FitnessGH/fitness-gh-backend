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
import { error, success } from "@/utils/response.util.js";

class UserController {
  /**
   * Get all users
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserService.getAllUsers();
      res.json(success(users));
    }
    catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json(error("Failed to fetch users", 500, null, null));
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
        res.status(404).json(error("User not found", 404, null, null));
        return;
      }

      res.json(success(user));
    }
    catch (err) {
      console.error("Error fetching user:", err);

      if (err instanceof z.ZodError) {
        res.status(400).json(error(
          "Invalid request parameters",
          400,
          err.errors,
          null,
        ));
        return;
      }

      res.status(500).json(error("Failed to fetch user", 500, null, null));
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

      res.status(201).json(success(user));
    }
    catch (err) {
      console.error("Error creating user:", err);

      if (err instanceof z.ZodError) {
        res.status(400).json(error(
          "Invalid request data",
          400,
          err.errors,
          null,
        ));
        return;
      }

      // Handle business logic errors with specific status codes
      if (err instanceof Error) {
        if (err.message.includes("already exists")) {
          res.status(409).json(error(err.message, 409, null, null));
          return;
        }
      }

      res.status(500).json(error("Failed to create user", 500, null, null));
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

      res.json(success(user));
    }
    catch (err) {
      console.error("Error updating user:", err);

      if (err instanceof z.ZodError) {
        res.status(400).json(error(
          "Invalid request data",
          400,
          err.errors,
          null,
        ));
        return;
      }

      // Handle business logic errors with specific status codes
      if (err instanceof Error && err.message === "User not found") {
        res.status(404).json(error(err.message, 404, null, null));
        return;
      }

      res.status(500).json(error("Failed to update user", 500, null, null));
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
    catch (err) {
      console.error("Error deleting user:", err);

      if (err instanceof z.ZodError) {
        res.status(400).json(error(
          "Invalid request parameters",
          400,
          err.errors,
          null,
        ));
        return;
      }

      // Handle business logic errors with specific status codes
      if (err instanceof Error && err.message === "User not found") {
        res.status(404).json(error(err.message, 404, null, null));
        return;
      }

      res.status(500).json(error("Failed to delete user", 500, null, null));
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
      res.json(success(users));
    }
    catch (err) {
      console.error("Error searching users:", err);

      if (err instanceof z.ZodError) {
        res.status(400).json(error(
          "Invalid search parameters",
          400,
          err.errors,
          null,
        ));
        return;
      }

      res.status(500).json(error("Failed to search users", 500, null, null));
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

      res.json(success(stats));
    }
    catch (err) {
      console.error("Error fetching user stats:", err);
      res.status(500).json(error("Failed to fetch user statistics", 500, null, null));
    }
  }
}

export default UserController;
