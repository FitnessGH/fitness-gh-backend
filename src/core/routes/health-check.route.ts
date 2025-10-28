import { Router } from "express";

import HealthCheckController from "@/core/controllers/health-check.controller";

const router: Router = Router();

router.get("/health-check", HealthCheckController.getHealthStatus);

export default router;
