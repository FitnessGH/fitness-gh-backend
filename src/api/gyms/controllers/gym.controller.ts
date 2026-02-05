import type { NextFunction, Request, Response } from "express";

import { parse } from "valibot";

import type { ApiResponse } from "../../../types/api-response.type.js";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware.js";
import { ForbiddenError } from "../../../errors/forbidden.error.js";
import { NotFoundError } from "../../../errors/not-found.error.js";

import GymService from "../services/gym.service.js";
import {
  addEmployeeSchema,
  createGymSchema,
  employeeIdSchema,
  gymIdSchema,
  gymSlugSchema,
  updateEmployeeSchema,
  updateGymSchema,
} from "../validations/gym.validation.js";

class GymController {
  // ========================================
  // GYM ENDPOINTS
  // ========================================

  /**
   * POST /gyms
   * Create a new gym (requires GYM_OWNER or SUPER_ADMIN)
   */
  async createGym(
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

      const validatedData = parse(createGymSchema, req.body);
      const gym = await GymService.createGym(profileId, validatedData);

      res.status(201).json({
        success: true,
        message: "Gym created successfully",
        data: gym,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms
   * List all active gyms (public)
   */
  async listGyms(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const gyms = await GymService.getAllGyms();

      res.status(200).json({
        success: true,
        data: gyms,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/my
   * Get gyms owned by the authenticated user
   */
  async getMyGyms(
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

      const ownedGyms = await GymService.getGymsByOwner(profileId);
      const employedGyms = await GymService.getEmploymentGyms(profileId);

      res.status(200).json({
        success: true,
        data: {
          owned: ownedGyms,
          employed: employedGyms,
        },
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:slug
   * Get gym by slug (public)
   */
  async getGymBySlug(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { slug } = parse(gymSlugSchema, req.params);
      const gym = await GymService.getGymBySlug(slug);

      if (!gym) {
        throw new NotFoundError({ message: "Gym not found" });
      }

      res.status(200).json({
        success: true,
        data: gym,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * PUT /gyms/:id
   * Update gym (requires owner or manager role)
   */
  async updateGym(
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

      const { id } = parse(gymIdSchema, req.params);
      const validatedData = parse(updateGymSchema, req.body);

      // Check access (owner or manager)
      await GymService.checkGymAccess(id, profileId, ["MANAGER"]);

      const gym = await GymService.updateGym(id, validatedData);

      res.status(200).json({
        success: true,
        message: "Gym updated successfully",
        data: gym,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /gyms/:id
   * Soft delete gym (owner only)
   */
  async deleteGym(
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

      const { id } = parse(gymIdSchema, req.params);

      // Check access (owner only)
      const { isOwner } = await GymService.checkGymAccess(id, profileId);
      if (!isOwner) {
        throw new ForbiddenError({ message: "Only the gym owner can delete the gym" });
      }

      await GymService.deleteGym(id);

      res.status(200).json({
        success: true,
        message: "Gym deleted successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }

  // ========================================
  // EMPLOYEE ENDPOINTS
  // ========================================

  /**
   * POST /gyms/:id/employees
   * Add employee to gym
   */
  async addEmployee(
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

      const { id: gymId } = parse(gymIdSchema, req.params);
      const { email, role } = parse(addEmployeeSchema, req.body);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      const employee = await GymService.addEmployeeByEmail(gymId, email, role);

      res.status(201).json({
        success: true,
        message: "Employee added successfully",
        data: employee,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * GET /gyms/:id/employees
   * List gym employees
   */
  async listEmployees(
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

      const { id: gymId } = parse(gymIdSchema, req.params);

      // Check access (any employee role or owner)
      await GymService.checkGymAccess(gymId, profileId);

      const employees = await GymService.getGymEmployees(gymId);

      res.status(200).json({
        success: true,
        data: employees,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * PUT /gyms/:id/employees/:employeeId
   * Update employee (role, status)
   */
  async updateEmployee(
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

      const { id: gymId } = parse(gymIdSchema, req.params);
      const { employeeId } = parse(employeeIdSchema, req.params);
      const validatedData = parse(updateEmployeeSchema, req.body);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      const employee = await GymService.updateEmployee(employeeId, validatedData);

      res.status(200).json({
        success: true,
        message: "Employee updated successfully",
        data: employee,
      });
    }
    catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /gyms/:id/employees/:employeeId
   * Remove employee
   */
  async removeEmployee(
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

      const { id: gymId } = parse(gymIdSchema, req.params);
      const { employeeId } = parse(employeeIdSchema, req.params);

      // Check access (owner or manager)
      await GymService.checkGymAccess(gymId, profileId, ["MANAGER"]);

      await GymService.removeEmployee(employeeId);

      res.status(200).json({
        success: true,
        message: "Employee removed successfully",
        data: null,
      });
    }
    catch (error) {
      next(error);
    }
  }
}

export default new GymController();
