import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { globalErrorHandler } from "./server/core/middleware.js";
import authRouter from "./server/api/auth/index.js";
import publicRouter from "./server/api/public/index.js";
import appointmentRouter from "./server/api/appointments/index.js";
import notificationRouter from "./server/api/notifications/index.js";
import recallRouter from "./server/api/recalls/index.js";
import analyticsRouter from "./server/api/analytics/index.js";
import usersRouter from "./server/api/users/index.js";
import adminRouter from "./server/api/admin/index.js";
import patientsRouter from "./server/api/patients/index.js";
import "./server/core/telegram.js"; // Initialize Telegram bot

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json());

  // ==========================================
  // API ROUTES (M01 - M18)
  // ==========================================
  
  // Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Dental Smart Booking API is running." });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/recalls", recallRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/patients", patientsRouter);

  // Global Error Handler (Must be after all API routes)
  app.use(globalErrorHandler);

  // ==========================================
  // VITE MIDDLEWARE (For React PWA)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Dental Smart Booking Engine running on port ${PORT}`);
  });
}

startServer();
