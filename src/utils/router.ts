import { Router, type RouterOptions } from "express";

/**
 * Creates a new Express Router instance with default configuration
 * @param options - Optional router configuration
 * @returns Configured Express Router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return Router({
    caseSensitive: false,
    mergeParams: false,
    strict: false,
    ...options,
  });
}

/**
 * Default router instance with standard configuration
 */
export const router = createRouter();

export default createRouter;