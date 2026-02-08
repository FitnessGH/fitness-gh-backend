import type { Request, Response } from "express";

import { ValiError, parse } from "valibot";

import type { ProfileStatsResponse } from "../types/user.types.js";

import UserService from "../services/user.service.js";
import {
  searchUserSchema,
  updateUserSchema,
  userIdSchema,
} from "../validations/user.validation.js";
import { error, success } from "../../../utils/response.util.js";

class UserController {
  /**
   * Get all profiles
   * If query param `withAccounts=true`, returns users with account info (for admin)
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const withAccountsParam = req.query.withAccounts;
      const withAccounts = withAccountsParam === 'true' || withAccountsParam === '1';
      
      console.log('getUsers called with withAccounts:', withAccounts, 'query:', req.query);
      
      if (withAccounts) {
        const users = await UserService.getAllUsersWithAccounts();
        console.log('Returning users with accounts, count:', users.length);
        res.json(success(users));
      } else {
        const profiles = await UserService.getAllProfiles();
        console.log('Returning profiles only, count:', profiles.length);
        res.json(success(profiles));
      }
    }
    catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json(error("Failed to fetch users", 500, null, null));
    }
  }

  /**
   * Get profile by ID
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters
      const { id } = parse(userIdSchema, req.params);

      const profile = await UserService.getProfileById(id);

      if (!profile) {
        res.status(404).json(error("Profile not found", 404, null, null));
        return;
      }

      res.json(success(profile));
    }
    catch (err) {
      console.error("Error fetching profile:", err);

      if (err instanceof ValiError) {
        res.status(400).json(error(
          "Invalid request parameters",
          400,
          err.issues,
          null,
        ));
        return;
      }

      res.status(500).json(error("Failed to fetch profile", 500, null, null));
    }
  }

  /**
   * Update profile
   */
  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters and body
      const { id } = parse(userIdSchema, req.params);
      const profileData = parse(updateUserSchema, req.body);

      const profile = await UserService.updateProfile(id, profileData);

      res.json(success(profile));
    }
    catch (err) {
      console.error("Error updating profile:", err);

      if (err instanceof ValiError) {
        res.status(400).json(error(
          "Invalid request data",
          400,
          err.issues,
          null,
        ));
        return;
      }

      // Handle business logic errors with specific status codes
      if (err instanceof Error && err.message === "Profile not found") {
        res.status(404).json(error(err.message, 404, null, null));
        return;
      }

      res.status(500).json(error("Failed to update profile", 500, null, null));
    }
  }

  /**
   * Delete profile
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      // Validate request parameters
      const { id } = parse(userIdSchema, req.params);

      await UserService.deleteProfile(id);
      res.status(204).send();
    }
    catch (err) {
      console.error("Error deleting profile:", err);

      if (err instanceof ValiError) {
        res.status(400).json(error(
          "Invalid request parameters",
          400,
          err.issues,
          null,
        ));
        return;
      }

      // Handle business logic errors with specific status codes
      if (err instanceof Error && err.message === "Profile not found") {
        res.status(404).json(error(err.message, 404, null, null));
        return;
      }

      res.status(500).json(error("Failed to delete profile", 500, null, null));
    }
  }

  /**
   * Search profiles
   */
  static async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { q } = parse(searchUserSchema, req.query);

      const profiles = await UserService.searchProfiles(q);
      res.json(success(profiles));
    }
    catch (err) {
      console.error("Error searching profiles:", err);

      if (err instanceof ValiError) {
        res.status(400).json(error(
          "Invalid search parameters",
          400,
          err.issues,
          null,
        ));
        return;
      }

      res.status(500).json(error("Failed to search profiles", 500, null, null));
    }
  }

  /**
   * Get profile statistics
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const totalProfiles = await UserService.getProfileCount();

      const stats: ProfileStatsResponse = {
        totalProfiles,
        timestamp: new Date().toISOString(),
      };

      res.json(success(stats));
    }
    catch (err) {
      console.error("Error fetching profile stats:", err);
      res.status(500).json(error("Failed to fetch profile statistics", 500, null, null));
    }
  }
}

export default UserController;
