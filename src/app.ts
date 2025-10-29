import type { Application } from "express";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { healthStatusRoute, infoRoute, initialRoute } from "@/core/routes";
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
    this.app.use(initialRoute);

    // Info route
    this.app.use(infoRoute);

    // Health check route
    this.app.use(healthStatusRoute);

    this.app.use((req) => {
      throw new NotFoundError({
        message: `🔍 - The requested endpoint does not exist! - ${req.originalUrl}`,
      });
    });

    this.app.use(errorHandler);
  }
}

export default new CreateApp().app;
