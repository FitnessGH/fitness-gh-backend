import type { Request, Response } from "express";

type NextFunction = (err?: unknown) => void;

import jwtService from "../core/services/jwt.service.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";

export type AuthenticatedRequest = Request & {
  accountId: string;
  userType: string;
  profileId?: string;
};

/**
 * Middleware to verify JWT access token
 * Attaches accountId, userType, and profileId to request
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = (req as { headers?: { authorization?: string } }).headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError({ message: "No access token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedError({ message: "Invalid or expired access token" });
    }

    // Attach user info to request
    (req as AuthenticatedRequest).accountId = payload.accountId;
    (req as AuthenticatedRequest).userType = payload.userType;
    (req as AuthenticatedRequest).profileId = payload.profileId;

    next();
  }
  catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't fail if not
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = (req as { headers?: { authorization?: string } }).headers?.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = jwtService.verifyAccessToken(token);

      if (payload) {
        (req as AuthenticatedRequest).accountId = payload.accountId;
        (req as AuthenticatedRequest).userType = payload.userType;
        (req as AuthenticatedRequest).profileId = payload.profileId;
      }
    }

    next();
  }
  catch {
    // Silently continue without auth for optional auth
    next();
  }
}

export default authenticate;
