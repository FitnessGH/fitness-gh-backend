import type { NextFunction, Request, Response } from "express";

import { parse } from "valibot";

import type { ApiResponse } from "../../../types/api-response.type.js";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware.js";
import { ForbiddenError } from "../../../errors/forbidden.error.js";

import MarketplaceService from "../services/marketplace.service.js";
import {
  createProductSchema,
  updateProductSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  productFiltersSchema,
} from "../validations/marketplace.validation.js";

class MarketplaceController {
  // ========================================
  // PRODUCT ENDPOINTS
  // ========================================

  /**
   * GET /marketplace/products
   * List all active products (public)
   */
  async listProducts(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filters = req.query ? parse(productFiltersSchema, req.query) : undefined;
      const products = await MarketplaceService.getAllProducts(filters);

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /marketplace/products/:id
   * Get product details (public)
   */
  async getProduct(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const product = await MarketplaceService.getProductById(id);

      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /marketplace/products
   * Create product (vendor only)
   */
  async createProduct(
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

      const validatedData = parse(createProductSchema, req.body);
      const product = await MarketplaceService.createProduct(profileId, validatedData);

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /marketplace/products/:id
   * Update product (vendor only)
   */
  async updateProduct(
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

      const { id } = req.params;
      const validatedData = parse(updateProductSchema, req.body);
      const product = await MarketplaceService.updateProduct(id, profileId, validatedData);

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /marketplace/products/:id
   * Delete product (vendor only)
   */
  async deleteProduct(
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

      const { id } = req.params;
      await MarketplaceService.deleteProduct(id, profileId);

      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /marketplace/products/my
   * Get vendor's products (vendor only)
   */
  async getMyProducts(
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

      const products = await MarketplaceService.getVendorProducts(profileId);

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // ORDER ENDPOINTS
  // ========================================

  /**
   * POST /marketplace/orders
   * Create order (customer only)
   */
  async createOrder(
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

      const validatedData = parse(createOrderSchema, req.body);
      const order = await MarketplaceService.createOrder(profileId, validatedData);

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /marketplace/orders/:id
   * Get order details
   */
  async getOrder(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const profileId = authReq.profileId;
      const userType = authReq.userType;

      if (!profileId) {
        throw new ForbiddenError({ message: "Profile not found" });
      }

      const { id } = req.params;
      const isAdmin = userType === "SUPER_ADMIN" || userType === "ADMIN";
      const order = await MarketplaceService.getOrderById(id, profileId, isAdmin);

      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /marketplace/orders/my
   * Get customer's orders (customer only)
   */
  async getMyOrders(
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

      const orders = await MarketplaceService.getCustomerOrders(profileId);

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /marketplace/orders/vendor/my
   * Get vendor's orders (vendor only)
   */
  async getVendorOrders(
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

      const orders = await MarketplaceService.getVendorOrders(profileId);

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /marketplace/orders/:id/status
   * Update order status (vendor/admin only)
   */
  async updateOrderStatus(
    req: Request,
    res: Response<ApiResponse<unknown>>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = parse(updateOrderStatusSchema, req.body);
      const order = await MarketplaceService.updateOrderStatus(id, validatedData);

      res.status(200).json({
        success: true,
        message: "Order status updated successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MarketplaceController();
