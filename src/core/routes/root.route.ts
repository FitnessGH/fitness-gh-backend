import type { Request, Response } from "express";

import { BaseRoute } from "@/core/base-route";

class RootRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/", this.getRoot.bind(this));
  }

  private getRoot(req: Request, res: Response): void {
    res.json({
      message: "Welcome to Fitness GH Backend API - 🚀",
      version: "1.0.0",
      endpoints: {
        users: "/api/v1/users",
        health: "/health",
        info: "/info",
      },
    });
  }
}

export default new RootRoute().getRouter();
