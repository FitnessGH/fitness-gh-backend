import type { NextFunction, Request, Response } from "express";

import type { ApiResponse } from "@/types";
import { NotFoundError } from "@/errors";

import AuthService from "../services/auth.service.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "../validations/auth.validation.js";
import type { AuthResponse, AuthTokens } from "../types/auth.types.js";

class AuthController {
  /**
   * POST /auth/register
   * Register a new user account
   */
  async register(
    req: Request,
    res: Response<ApiResponse<AuthResponse>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);

      res.status(201).json({
        success: true,
        message: "Account registered successfully",
        data: result,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/login
   * Login with email and password
   */
  async login(
    req: Request,
    res: Response<ApiResponse<AuthResponse>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(
    req: Request,
    res: Response<ApiResponse<AuthTokens>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const tokens = await AuthService.refresh(refreshToken);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: tokens,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/logout
   * Logout by invalidating refresh token
   */
  async logout(
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      await AuthService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/logout-all
   * Logout from all devices
   */
  async logoutAll(
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      // This endpoint requires authentication (middleware will add accountId)
      const accountId = (req as Request & { accountId: string }).accountId;
      await AuthService.logoutAll(accountId);

      res.status(200).json({
        success: true,
        message: "Logged out from all devices",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me
   * Get current user's account and profile
   */
  async me(
    req: Request,
    res: Response<ApiResponse<{ account: unknown; profile: unknown }>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const accountId = (req as Request & { accountId: string }).accountId;
      const result = await AuthService.getAccountById(accountId);

      if (!result) {
        throw new NotFoundError({ message: "Account not found" });
      }

      res.status(200).json({
        success: true,
        message: "Account retrieved successfully",
        data: result,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/change-password
   * Change password (requires authentication)
   */
  async changePassword(
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const accountId = (req as Request & { accountId: string }).accountId;
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      await AuthService.changePassword(accountId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: "Password changed successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
