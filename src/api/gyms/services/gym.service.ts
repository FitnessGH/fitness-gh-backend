import type { EmployeeRole, Gym, Employment } from "@prisma/client";

import { prisma } from "../../core/services/prisma.service.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { ForbiddenError } from "../../errors/forbidden.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";

import type {
  CreateGymData,
  EmployeeResponse,
  GymResponse,
  GymWithOwner,
  UpdateEmploymentData,
  UpdateGymData,
} from "../types/gym.types.js";

class GymService {
  // ========================================
  // GYM CRUD OPERATIONS
  // ========================================

  /**
   * Create a new gym
   */
  async createGym(ownerId: string, data: CreateGymData): Promise<Gym> {
    // Check if slug already exists
    const existingSlug = await prisma.gym.findUnique({
      where: { slug: data.slug },
    });
    if (existingSlug) {
      throw new ConflictError({ message: "A gym with this slug already exists" });
    }

    return await prisma.gym.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

  /**
   * Get all gyms (public list)
   */
  async getAllGyms(options?: { isActive?: boolean }): Promise<GymResponse[]> {
    return await prisma.gym.findMany({
      where: {
        isActive: options?.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        city: true,
        region: true,
        country: true,
        latitude: true,
        longitude: true,
        phone: true,
        email: true,
        website: true,
        logoUrl: true,
        coverUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get gym by ID with owner info
   */
  async getGymById(id: string): Promise<GymWithOwner | null> {
    return await prisma.gym.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get gym by slug with owner info
   */
  async getGymBySlug(slug: string): Promise<GymWithOwner | null> {
    return await prisma.gym.findUnique({
      where: { slug },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Get gyms owned by a user
   */
  async getGymsByOwner(ownerId: string): Promise<Gym[]> {
    return await prisma.gym.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update gym
   */
  async updateGym(id: string, data: UpdateGymData): Promise<Gym> {
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      throw new NotFoundError({ message: "Gym not found" });
    }

    return await prisma.gym.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete gym (set isActive to false)
   */
  async deleteGym(id: string): Promise<void> {
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      throw new NotFoundError({ message: "Gym not found" });
    }

    await prisma.gym.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Check if user has access to manage gym
   */
  async checkGymAccess(
    gymId: string,
    profileId: string,
    requiredRoles?: EmployeeRole[],
  ): Promise<{ gym: Gym; isOwner: boolean; employeeRole?: EmployeeRole }> {
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      throw new NotFoundError({ message: "Gym not found" });
    }

    // Check if user is owner
    if (gym.ownerId === profileId) {
      return { gym, isOwner: true };
    }

    // Check if user is employee with required role
    const employment = await prisma.employment.findUnique({
      where: {
        profileId_gymId: { profileId, gymId },
      },
    });

    if (!employment || !employment.isActive) {
      throw new ForbiddenError({ message: "You do not have access to this gym" });
    }

    if (requiredRoles && !requiredRoles.includes(employment.role)) {
      throw new ForbiddenError({ message: "You do not have permission for this action" });
    }

    return { gym, isOwner: false, employeeRole: employment.role };
  }

  // ========================================
  // EMPLOYEE MANAGEMENT
  // ========================================

  /**
   * Add employee to gym
   */
  async addEmployee(gymId: string, profileId: string, role: EmployeeRole): Promise<Employment> {
    // Check if profile exists
    const profile = await prisma.userProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      throw new NotFoundError({ message: "User profile not found" });
    }

    // Check if already employed at this gym
    const existingEmployment = await prisma.employment.findUnique({
      where: {
        profileId_gymId: { profileId, gymId },
      },
    });
    if (existingEmployment) {
      throw new ConflictError({ message: "User is already an employee at this gym" });
    }

    return await prisma.employment.create({
      data: {
        profileId,
        gymId,
        role,
      },
    });
  }

  /**
   * Add employee by email (finds profile first)
   */
  async addEmployeeByEmail(gymId: string, email: string, role: EmployeeRole): Promise<Employment> {
    // Find account by email
    const account = await prisma.account.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!account || !account.profile) {
      throw new NotFoundError({ message: "No user found with this email" });
    }

    return await this.addEmployee(gymId, account.profile.id, role);
  }

  /**
   * Get all employees of a gym
   */
  async getGymEmployees(gymId: string): Promise<EmployeeResponse[]> {
    const employees = await prisma.employment.findMany({
      where: { gymId },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return employees.map((emp) => ({
      id: emp.id,
      profileId: emp.profileId,
      gymId: emp.gymId,
      role: emp.role,
      isActive: emp.isActive,
      startDate: emp.startDate,
      endDate: emp.endDate,
      createdAt: emp.createdAt,
      profile: emp.profile,
    }));
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(employeeId: string): Promise<Employment | null> {
    return await prisma.employment.findUnique({
      where: { id: employeeId },
    });
  }

  /**
   * Update employee
   */
  async updateEmployee(employeeId: string, data: UpdateEmploymentData): Promise<Employment> {
    const employee = await prisma.employment.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundError({ message: "Employee not found" });
    }

    return await prisma.employment.update({
      where: { id: employeeId },
      data,
    });
  }

  /**
   * Remove employee (sets isActive to false and endDate)
   */
  async removeEmployee(employeeId: string): Promise<void> {
    const employee = await prisma.employment.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundError({ message: "Employee not found" });
    }

    await prisma.employment.update({
      where: { id: employeeId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });
  }

  /**
   * Get gyms where user is employed
   */
  async getEmploymentGyms(profileId: string): Promise<Array<Employment & { gym: Gym }>> {
    return await prisma.employment.findMany({
      where: {
        profileId,
        isActive: true,
      },
      include: { gym: true },
    });
  }
}

export default new GymService();
