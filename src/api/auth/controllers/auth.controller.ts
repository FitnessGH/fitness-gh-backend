import type { NextFunction, Request, Response } from "express";
import { parse } from "valibot";
import type { ApiResponse } from "../../../types/api-response.type.js";
import { NotFoundError } from "../../../errors/not-found.error.js";
import AuthService from "../services/auth.service.js";
import emailService from "../../../core/services/email.service.js";
import otpService from "../../../core/services/otp.service.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  sendOTPSchema,
  verifyOTPSchema,
} from "../validations/auth.validation.js";
import type { AuthResponse, AuthTokens, OTPResponse, RegisterData } from "../types/auth.types.js";

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
      const validatedData = parse(registerSchema, req.body);
      const result = await AuthService.register(validatedData as RegisterData);

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
      const validatedData = parse(loginSchema, req.body);
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
      const { refreshToken } = parse(refreshTokenSchema, req.body);
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
      const { refreshToken } = parse(refreshTokenSchema, req.body);
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
   * POST /auth/send-otp
   * Send OTP to email for verification
   */
  async sendOTP(
    req: Request,
    res: Response<ApiResponse<OTPResponse>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email } = parse(sendOTPSchema, req.body);
      
      // Generate and store OTP
      const otp = await otpService.createEmailOTP(email);
      
      // Send OTP email
      await emailService.sendVerificationEmail(email, otp);

      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: { success: true, message: "OTP sent to your email" },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP for email
   */
  async verifyOTP(
    req: Request,
    res: Response<ApiResponse<OTPResponse>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, otp } = parse(verifyOTPSchema, req.body);
      
      const isValid = await otpService.verifyEmailOTP(email, otp);
      
      if (!isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
          status: 400,
          data: { success: false, message: "Invalid or expired OTP" },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        data: { success: true, message: "Email verified successfully" },
      });
    } catch (error) {
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
      const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);

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
