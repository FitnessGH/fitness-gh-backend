import type { Request, Response } from "express";

import { BaseRoute } from "@/core/base-route";
import { description, name, version } from "@root/package.json" with { type: "json" };

class InfoRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/info", this.getInfo.bind(this));
  }

  private getInfo(req: Request, res: Response): void {
    res.json({
      name,
      version,
      description,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}

export default new InfoRoute().getRouter();
