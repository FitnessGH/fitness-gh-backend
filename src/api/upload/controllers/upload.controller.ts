import type { NextFunction, Request, Response } from "express";
import { put } from "@vercel/blob";
import type { ApiResponse } from "../../../types/api-response.type.js";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware.js";
import { ForbiddenError } from "../../../errors/forbidden.error.js";
import { ClientError } from "../../../errors/client.error.js";

class UploadController {
  /**
   * POST /upload?filename=image.jpg
   * Upload a single image file to Vercel Blob Storage
   * Follows Vercel's recommended pattern: frontend uploads file directly
   */
  async uploadImage(
    req: Request,
    res: Response<ApiResponse<{ url: string }>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const profileId = authReq.profileId;

      if (!profileId) {
        throw new ForbiddenError({ message: "Profile not found" });
      }

      // Get filename from query params (following Vercel pattern)
      const filename = req.query.filename as string;
      if (!filename) {
        throw new ClientError({ message: "Filename is required" });
      }

      // Get file from request body (raw buffer from express.raw middleware)
      const fileBuffer = req.body as Buffer;

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new ClientError({ message: "No file provided" });
      }

      // Get content type from headers
      const contentType = (req.headers["content-type"] || "image/jpeg").split(";")[0].trim();
      
      // Validate content type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.some(type => contentType.includes(type))) {
        throw new ClientError({
          message: "Invalid file type. Only images are allowed.",
        });
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (fileBuffer.length > maxSize) {
        throw new ClientError({
          message: "File size exceeds 5MB limit",
        });
      }

      // Generate unique filename with user's profile ID
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = filename.split(".").pop() || "jpg";
      const uniqueFilename = `products/${profileId}/${timestamp}-${randomString}.${extension}`;

      // Upload to Vercel Blob Storage
      const blob = await put(uniqueFilename, fileBuffer, {
        access: "public",
        contentType: contentType,
      });

      res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        data: { url: blob.url },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UploadController();
