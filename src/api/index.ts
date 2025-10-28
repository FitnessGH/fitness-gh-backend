import { Router } from "express";

import type MessageResponse from "@/types/message-response.type";

const router: Router = Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "Welcome to Fitness GH Backend API - 🚀",
  });
});



export default router;
