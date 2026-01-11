import type { NextFunction, Request, Response } from "express";

import type { ApiResponse } from "@/types";
import type { AuthenticatedRequest } from "@/middlewares/auth.middleware";
import { ForbiddenError, NotFoundError } from "@/errors";
import GymService from "@/api/gyms/services/gym.service.js";

import PaymentService from "../services/payment.service.js";
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  webhookSchema,
} from "../validations/payment.validation.js";
import { gymIdSchema } from "@/api/gyms/validations/gym.validation.js";

class PaymentController {
  /**
   * POST /payments/initiate
   * Initiate a payment
   */
  async initiate(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const profileId = authReq.profileId;

      if (!profileId) {
        throw new ForbiddenError({ message: "Profile not found" });
      }

      const validatedData = initiatePaymentSchema.parse(req.body);

      const payment = await PaymentService.initiatePayment({
        profileId,
        ...validatedData,
      });

      res.status(200).json({
        success: true,
        message: "Payment initiated",
        data: payment,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/verify/:reference
   * Verify payment status
   */
  async verify(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { reference } = verifyPaymentSchema.parse(req.params);
      const result = await PaymentService.verifyPayment(reference);

      res.status(200).json({
        success: true,
        message: "Payment verification result",
        data: result,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/webhook
   * Simulated webhook listener
   */
  async webhook(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      // In real scenario, validate signature here
      const event = webhookSchema.parse(req.body);
      
      // Async processing
      await PaymentService.handleWebhook(event as any);

      res.status(200).json({
        success: true,
        message: "Webhook processed",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/my
   * Get authenticated user's payment history
   */
  async getMyPayments(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const profileId = authReq.profileId;

      if (!profileId) {
        throw new ForbiddenError({ message: "Profile not found" });
      }

      const payments = await PaymentService.getUserPayments(profileId);

      res.status(200).json({
        success: true,
        data: payments,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:id/payments
   * Get gym's payment history (Owner/Manager only)
   */
  async getGymPayments(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const profileId = authReq.profileId;

      if (!profileId) {
        throw new ForbiddenError({ message: "Profile not found" });
      }

      const { id: gymId } = gymIdSchema.parse(req.params);

      // Check access
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      const payments = await PaymentService.getGymPayments(gymId);

      res.status(200).json({
        success: true,
        data: payments,
      });
    }
    catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
