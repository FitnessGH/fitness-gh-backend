import type { NextFunction, Request, Response } from "express";

import type { UserType } from "@prisma/client";

import { ForbiddenError } from "../errors/forbidden.error.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";

import type { AuthenticatedRequest } from "./auth.middleware.js";

/**
 * Middleware to require specific user types (roles)
 * Must be used after authenticate middleware
 */
export function requireRole(...allowedRoles: UserType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.accountId) {
        throw new UnauthorizedError({ message: "Authentication required" });
      }

      if (!allowedRoles.includes(authReq.userType as UserType)) {
        throw new ForbiddenError({
          message: "You do not have permission to access this resource",
        });
      }

      next();
    }
    catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require gym owner role
 */
export const requireGymOwner = requireRole("GYM_OWNER", "SUPER_ADMIN");

/**
 * Middleware to require employee or higher role
 */
export const requireEmployee = requireRole("EMPLOYEE", "GYM_OWNER", "SUPER_ADMIN");

/**
 * Middleware to require member or higher role (basically any authenticated user)
 */
export const requireMember = requireRole("MEMBER", "EMPLOYEE", "GYM_OWNER", "SUPER_ADMIN");

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = requireRole("SUPER_ADMIN");

export default requireRole;
