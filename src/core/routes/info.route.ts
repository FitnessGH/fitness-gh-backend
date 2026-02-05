import type { Request, Response } from "express";

import { BaseRoute } from "../base-route.js";
import packageJson from "../../../package.json" with { type: "json" };

class InfoRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.get("/info", this.getInfo.bind(this));
  }

  private getInfo(req: Request, res: Response): void {
    const { name, version, description } = packageJson as {
      name?: string;
      version?: string;
      description?: string;
    };

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
