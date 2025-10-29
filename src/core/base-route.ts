import type { Router, RequestHandler, Request, Response, NextFunction } from "express";
import { createRouter } from "@/utils/router";

/**
 * Base class for creating route modules
 * Provides a configured router instance and common route methods
 */
export abstract class BaseRoute {
  protected router: Router;

  constructor() {
    this.router = createRouter();
    this.initializeRoutes();
  }

  /**
   * Abstract method to be implemented by each route class
   * Define your routes in this method
   */
  protected abstract initializeRoutes(): void;

  /**
   * Get the configured router instance
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Helper method to add GET route
   */
  protected get(path: string, ...handlers: RequestHandler[]): void {
    this.router.get(path, ...handlers);
  }

  /**
   * Helper method to add POST route
   */
  protected post(path: string, ...handlers: RequestHandler[]): void {
    this.router.post(path, ...handlers);
  }

  /**
   * Helper method to add PUT route
   */
  protected put(path: string, ...handlers: RequestHandler[]): void {
    this.router.put(path, ...handlers);
  }

  /**
   * Helper method to add DELETE route
   */
  protected delete(path: string, ...handlers: RequestHandler[]): void {
    this.router.delete(path, ...handlers);
  }

  /**
   * Helper method to add PATCH route
   */
  protected patch(path: string, ...handlers: RequestHandler[]): void {
    this.router.patch(path, ...handlers);
  }

  /**
   * Helper method to add middleware to all routes
   */
  protected use(...handlers: RequestHandler[]): void {
    this.router.use(...handlers);
  }

  /**
   * Helper method to add route-specific middleware
   */
  protected useFor(path: string, ...handlers: RequestHandler[]): void {
    this.router.use(path, ...handlers);
  }

  /**
   * Common error handler wrapper
   */
  protected asyncHandler(fn: RequestHandler): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Common validation wrapper
   */
  protected validate(validationFn: (req: Request) => string | null): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = validationFn(req);
      if (error) {
        res.status(400).json({ error });
        return;
      }
      next();
    };
  }
}

export default BaseRoute;