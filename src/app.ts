import type { Request } from "express";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import apiRoute from "./api/index.js";
import { API_PREFIXES } from "./config/constants.config.js";
import healthStatusRoute from "./core/routes/health-check.route.js";
import infoRoute from "./core/routes/info.route.js";
import rootRoute from "./core/routes/root.route.js";
import { NotFoundError } from "./errors/not-found.error.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";

const app = express();

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Root route
app.use(rootRoute);

// Info route
app.use(infoRoute);

// Health check route
app.use(healthStatusRoute);

// API routes
app.use(API_PREFIXES.V1, apiRoute);

app.use((req: Request) => {
  throw new NotFoundError({
    message: `🔍 - The requested endpoint does not exist! - ${req.originalUrl}`,
  });
});

app.use(errorHandler);

export default app;
