import express from "express";
import { BaseRoute } from "../../../core/base-route.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import UploadController from "../controllers/upload.controller.js";

class UploadRoute extends BaseRoute {
  protected initializeRoutes(): void {
    // Protected routes - require authentication
    // Following Vercel's pattern: POST /upload?filename=image.jpg
    // Use raw body parser for file uploads (limit 5MB)
    this.router.post(
      "/",
      authenticate,
      express.raw({ type: "image/*", limit: "5mb" }),
      UploadController.uploadImage,
    );
  }
}

export default new UploadRoute().getRouter();
