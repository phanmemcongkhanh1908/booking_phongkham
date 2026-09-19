process.env.TZ = 'Asia/Ho_Chi_Minh';
import webpush from 'web-push';
import nodeCron from 'node-cron';
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
import ttsRouter from "./server/api/tts/index.js";
import patientsRouter from "./server/api/patients/index.js";
import "./server/core/telegram.js"; // Initialize Telegram bot
import { bootstrapSystem } from "./server/core/bootstrap.js";
import { initReminderCronJob } from "./server/jobs/appointmentReminder.js";

dotenv.config();

async function startServer() {
  
// Setup Web Push
webpush.setVapidDetails(
    'mailto:support@dentalbooking.com',
    process.env.VAPID_PUBLIC_KEY || 'BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk',
    process.env.VAPID_PRIVATE_KEY || 'Tqn3SBNkFGIiSf6uGoGvpDfZXjH1XDesiM9XA5nTiZU'
  );

// Store subscriptions mapped to phone numbers or appointment IDs
const subscriptions = new Map<string, any>();

const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json());

  // ==========================================
  // API ROUTES (M01 - M18)
  // ==========================================
  
  // Healthcheck
  
  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk' });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const { subscription, phone, patientId } = req.body;
    if (!subscription || (!phone && !patientId)) {
      return res.status(400).json({ error: 'Subscription and phone/patientId required' });
    }
    
    try {
      const { db } = await import('./server/db/index.js');
      const { patients, pushSubscriptions } = await import('./server/db/schema.js');
      const { eq } = await import('drizzle-orm');

      const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
      let resolvedPatientId = patientId;

      if (!resolvedPatientId && cleanPhone) {
        const pts = await db.select().from(patients).where(eq(patients.phone, cleanPhone));
        if (pts.length > 0) {
          resolvedPatientId = pts[0].id;
        }
      }

      // Check if subscription endpoint already exists
      const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      if (existing.length > 0) {
        await db.update(pushSubscriptions).set({
          patientId: resolvedPatientId || existing[0].patientId,
          phone: cleanPhone || existing[0].phone,
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
          updatedAt: new Date(),
        }).where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          id: 'sub_' + Math.random().toString(36).substring(2, 12),
          patientId: resolvedPatientId || null,
          phone: cleanPhone || phone || null,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
          createdAt: new Date(),
        });
      }
      
      res.status(201).json({ success: true, message: 'Đăng ký nhận thông báo đẩy thành công.' });
    } catch(err) {
      console.error('Push subscribe error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/push/test', async (req, res) => {
    const { phone, patientId } = req.body;
    try {
      const { sendWebPush } = await import('./server/services/notification.js');
      await sendWebPush(
        { patientId, phone },
        {
          title: "🔔 Thử nghiệm thông báo đẩy",
          body: "Tính năng thông báo Web Push đã hoạt động! Bạn sẽ nhận được thông báo tự động khi lịch khám được duyệt hoặc đổi trạng thái.",
          url: "/lich-hen-cua-toi"
        }
      );
      res.json({ success: true, message: 'Đã gửi thông báo thử nghiệm.' });
    } catch (err: any) {
      console.error('Push test error:', err);
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Dental Smart Booking API is running." });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/tts", ttsRouter);
  app.use("/api/recalls", recallRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/patients", patientsRouter);

  // Global Error Handler (Must be after all API routes)
  
  // Handle 404 for API routes
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Không tìm thấy API: ${req.method} ${req.originalUrl}` }});
  });

  app.use(globalErrorHandler);

  // Direct internal short links: /b/:slug and /s/:slug -> /booking/:slug
  app.get(["/b/:slug", "/s/:slug"], (req, res) => {
    const slug = req.params.slug;
    res.redirect(302, `/booking/${slug}`);
  });

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

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[Server] Dental Smart Booking Engine running on http://localhost:${PORT}`);
    try {
      await bootstrapSystem();
      initReminderCronJob();
      console.log("[Server] System bootstrapping completed.");
    } catch (err: any) {
      console.warn("[Server] Bootstrap non-critical warning:", err.message);
    }
  });
}


startServer();
