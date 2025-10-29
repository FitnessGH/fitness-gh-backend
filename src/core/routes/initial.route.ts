import { BaseRoute } from "@/core/base-route";
import type { Request, Response } from "express";

class ApiRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/", this.getRoot.bind(this));
  }

  private getRoot(req: Request, res: Response): void {
    res.json({
      message: "Welcome to Fitness GH Backend API - 🚀",
    });
  }

}

export default new ApiRoute().getRouter();