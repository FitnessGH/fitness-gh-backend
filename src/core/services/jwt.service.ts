import type { JwtPayload, SignOptions } from "jsonwebtoken";

import jwt from "jsonwebtoken";

import config from "../../config/env.config.js";

export type TokenPayload = {
  accountId: string;
  userType: string;
  profileId?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

class JwtService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiry: string;

  constructor() {
    this.accessSecret = config.jwtAccessSecret;
    this.refreshSecret = config.jwtRefreshSecret;
    this.accessExpiry = config.jwtAccessExpiry;
    this.refreshExpiry = config.jwtRefreshExpiry;
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokenPair(payload: TokenPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    return { accessToken, refreshToken };
  }

  /**
   * Generate short-lived access token
   */
  generateAccessToken(payload: TokenPayload): string {
    const options: SignOptions = {
      expiresIn: this.accessExpiry as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, this.accessSecret, options);
  }

  /**
   * Generate long-lived refresh token
   */
  generateRefreshToken(payload: TokenPayload): string {
    const options: SignOptions = {
      expiresIn: this.refreshExpiry as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, this.refreshSecret, options);
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessSecret) as JwtPayload & TokenPayload;
      return {
        accountId: decoded.accountId,
        userType: decoded.userType,
        profileId: decoded.profileId,
      };
    }
    catch {
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as JwtPayload & TokenPayload;
      return {
        accountId: decoded.accountId,
        userType: decoded.userType,
        profileId: decoded.profileId,
      };
    }
    catch {
      return null;
    }
  }

  /**
   * Decode token without verification (for expired tokens)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload & TokenPayload;
      if (!decoded) return null;
      return {
        accountId: decoded.accountId,
        userType: decoded.userType,
        profileId: decoded.profileId,
      };
    }
    catch {
      return null;
    }
  }

  /**
   * Get refresh token expiry date
   */
  getRefreshTokenExpiry(): Date {
    // Parse expiry string (e.g., "7d" -> 7 days)
    const match = this.refreshExpiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default to 7 days if parsing fails
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * (multipliers[unit] || multipliers.d));
  }
}

export default new JwtService();
