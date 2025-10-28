import type { NextFunction, Request, Response } from "express";

import type { CustomRequest } from "@/types";

export function asyncHandler(fn: (req: CustomRequest, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req as CustomRequest, res, next)).catch(next);
  };
}
