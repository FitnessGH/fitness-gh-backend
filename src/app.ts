import type { Application } from "express";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import apiRoute from "@/api/index";
import { API_PREFIXES } from "@/config";
import { healthStatusRoute, infoRoute, rootRoute } from "@/core/routes";
import { NotFoundError } from "@/errors";
import { errorHandler } from "@/middlewares";

class CreateApp {
  public app: Application;

  constructor() {
    this.app = express();
    this.middleware();
  }

  middleware() {
    this.app.use(helmet());
    this.app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
    this.app.use(cors());
    this.app.use(morgan("combined"));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));

    // Root route
    this.app.use(rootRoute);

    // Info route
    this.app.use(infoRoute);

    // Health check route
    this.app.use(healthStatusRoute);

    // API routes
    this.app.use(API_PREFIXES.V1, apiRoute);

    this.app.use((req) => {
      throw new NotFoundError({
        message: `🔍 - The requested endpoint does not exist! - ${req.originalUrl}`,
      });
    });

    this.app.use(errorHandler);
  }
}

export default new CreateApp().app;
