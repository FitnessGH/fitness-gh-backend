import type { NextFunction, Request, Response } from "express";

import type { ApiResponse } from "@/types";
import type { AuthenticatedRequest } from "@/middlewares/auth.middleware";
import { ForbiddenError, NotFoundError } from "@/errors";
import GymService from "@/api/gyms/services/gym.service.js";

import SubscriptionService from "../services/subscription.service.js";
import {
  createMembershipByStaffSchema,
  createMembershipSchema,
  createPlanSchema,
  membershipIdSchema,
  planIdSchema,
  updateMembershipSchema,
  updatePlanSchema,
} from "../validations/subscription.validation.js";
import { gymIdSchema } from "@/api/gyms/validations/gym.validation.js";

class SubscriptionController {
  // ========================================
  // SUBSCRIPTION PLAN ENDPOINTS
  // ========================================

  /**
   * POST /gyms/:id/plans
   * Create a new subscription plan
   */
  async createPlan(
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
      const validatedData = createPlanSchema.parse(req.body);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      const plan = await SubscriptionService.createPlan(gymId, validatedData);

      res.status(201).json({
        success: true,
        message: "Subscription plan created successfully",
        data: plan,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:id/plans
   * List subscription plans for a gym (public)
   */
  async listPlans(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id: gymId } = gymIdSchema.parse(req.params);

      // Show only active plans for public view
      const plans = await SubscriptionService.getGymPlans(gymId, { activeOnly: true });

      res.status(200).json({
        success: true,
        data: plans,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:id/plans/:planId
   * Get a specific plan
   */
  async getPlan(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { planId } = planIdSchema.parse(req.params);
      const plan = await SubscriptionService.getPlanById(planId);

      if (!plan) {
        throw new NotFoundError({ message: "Subscription plan not found" });
      }

      res.status(200).json({
        success: true,
        data: plan,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * PUT /gyms/:id/plans/:planId
   * Update a subscription plan
   */
  async updatePlan(
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
      const { planId } = planIdSchema.parse(req.params);
      const validatedData = updatePlanSchema.parse(req.body);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      const plan = await SubscriptionService.updatePlan(planId, validatedData);

      res.status(200).json({
        success: true,
        message: "Subscription plan updated successfully",
        data: plan,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /gyms/:id/plans/:planId
   * Delete a subscription plan (soft delete)
   */
  async deletePlan(
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
      const { planId } = planIdSchema.parse(req.params);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      await SubscriptionService.deletePlan(planId);

      res.status(200).json({
        success: true,
        message: "Subscription plan deleted successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }

  // ========================================
  // MEMBERSHIP ENDPOINTS
  // ========================================

  /**
   * POST /gyms/:id/memberships
   * Create a membership (by staff for a member)
   */
  async createMembership(
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
      const { email, planId, startDate, autoRenew } = createMembershipByStaffSchema.parse(req.body);

      // Check access (owner, manager, or receptionist)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER", "RECEPTIONIST"]);

      const membership = await SubscriptionService.createMembershipByEmail(
        gymId,
        email,
        planId,
        { startDate, autoRenew },
      );

      res.status(201).json({
        success: true,
        message: "Membership created successfully",
        data: membership,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /gyms/:id/memberships/self
   * Self-subscribe to a gym plan
   */
  async selfSubscribe(
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
      const { planId, startDate, autoRenew } = createMembershipSchema.parse(req.body);

      const membership = await SubscriptionService.createMembership({
        profileId,
        gymId,
        planId,
        startDate,
        autoRenew,
      });

      res.status(201).json({
        success: true,
        message: "Membership created successfully. Please complete payment to activate.",
        data: membership,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:id/memberships
   * List all memberships for a gym
   */
  async listMemberships(
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
      await GymService.checkGymAccess(gymId, profileId);

      const memberships = await SubscriptionService.getGymMemberships(gymId);

      res.status(200).json({
        success: true,
        data: memberships,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /memberships/my
   * Get current user's memberships
   */
  async getMyMemberships(
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

      const memberships = await SubscriptionService.getUserMemberships(profileId);

      res.status(200).json({
        success: true,
        data: memberships,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * PUT /gyms/:id/memberships/:membershipId
   * Update a membership
   */
  async updateMembership(
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
      const { membershipId } = membershipIdSchema.parse(req.params);
      const validatedData = updateMembershipSchema.parse(req.body);

      // Check access (owner, manager, or receptionist)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER", "RECEPTIONIST"]);

      const membership = await SubscriptionService.updateMembership(membershipId, validatedData);

      res.status(200).json({
        success: true,
        message: "Membership updated successfully",
        data: membership,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * POST /gyms/:id/memberships/:membershipId/activate
   * Activate a membership (typically after payment verification)
   */
  async activateMembership(
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
      const { membershipId } = membershipIdSchema.parse(req.params);

      // Check access (owner, manager, or receptionist)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER", "RECEPTIONIST"]);

      const membership = await SubscriptionService.activateMembership(membershipId);

      res.status(200).json({
        success: true,
        message: "Membership activated successfully",
        data: membership,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /gyms/:id/memberships/:membershipId
   * Cancel a membership
   */
  async cancelMembership(
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
      const { membershipId } = membershipIdSchema.parse(req.params);

      // Check if user is cancelling their own membership or has staff access
      const membership = await SubscriptionService.getMembershipById(membershipId);
      if (!membership) {
        throw new NotFoundError({ message: "Membership not found" });
      }

      const isOwnMembership = membership.profileId === profileId;
      if (!isOwnMembership) {
        // Staff needs proper access
        await GymService.checkGymAccess(gymId, profileId, ["MANAGER", "RECEPTIONIST"]);
      }

      await SubscriptionService.cancelMembership(membershipId);

      res.status(200).json({
        success: true,
        message: "Membership cancelled successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }
}

export default new SubscriptionController();
