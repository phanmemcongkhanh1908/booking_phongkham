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

// Tự động nhận diện môi trường:
// 1. Chạy bundle đã build (node dist/server.cjs trên Render) -> Ép chặt NODE_ENV = 'production'
// 2. Chạy file nguồn server.ts trong môi trường phát triển (tsx / npm run dev) -> NODE_ENV = 'development'
const isProductionBundle = (process.argv[1] || '').includes('dist') || (process.argv[1] || '').endsWith('.cjs');
if (isProductionBundle) {
  process.env.NODE_ENV = 'production';
} else if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Bảo vệ tiến trình Node.js không bị crash khi kết nối mạng/proxy đám mây bị ngắt đột ngột
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ [Process] Unhandled Promise Rejection (non-fatal):', reason);
});
process.on('uncaughtException', (error) => {
  console.error('⚠️ [Process] Uncaught Exception (caught safely):', error);
});

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
  const PORT = Number(process.env.PORT) || 3000;

  // Trust reverse proxy (Cloudflare, Render, Google Cloud Run) for accurate client IP
  app.set('trust proxy', 1);

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
    const { subscription, phone, patientId, clinicSlug, tenantId } = req.body;
    if (!subscription?.endpoint || (!phone && !patientId)) {
      return res.status(400).json({ error: 'Subscription and phone/patientId required' });
    }
    
    try {
      const { db } = await import('./server/db/index.js');
      const { patients, pushSubscriptions } = await import('./server/db/schema.js');
      const { eq } = await import('drizzle-orm');

      const rawDigits = phone ? String(phone).replace(/\D/g, '') : '';
      const cleanPhone = rawDigits.startsWith('84') && rawDigits.length >= 10 ? `0${rawDigits.slice(2)}` : rawDigits;
      let resolvedPatientId = patientId || null;

      if (!resolvedPatientId && cleanPhone) {
        const allPts = await db.select().from(patients);
        const suffix9 = cleanPhone.slice(-9);
        const matchedPt = (allPts as any[]).find((p) => {
          const pDigits = String(p?.phone || '').replace(/\D/g, '');
          const pNorm = pDigits.startsWith('84') && pDigits.length >= 10 ? `0${pDigits.slice(2)}` : pDigits;
          return pNorm === cleanPhone || (suffix9.length >= 9 && pNorm.slice(-9) === suffix9);
        });
        if (matchedPt) {
          resolvedPatientId = matchedPt.id;
        }
      }

      // Check if subscription endpoint already exists
      const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      if (existing.length > 0) {
        await db.update(pushSubscriptions).set({
          subscriberType: 'patient',
          patientId: resolvedPatientId || existing[0].patientId,
          phone: cleanPhone || existing[0].phone,
          tenantId: tenantId || existing[0].tenantId || null,
          clinicSlug: clinicSlug || existing[0].clinicSlug || null,
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
          updatedAt: new Date(),
        }).where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          id: 'sub_' + Math.random().toString(36).substring(2, 12),
          subscriberType: 'patient',
          patientId: resolvedPatientId || null,
          phone: cleanPhone || phone || null,
          tenantId: tenantId || null,
          clinicSlug: clinicSlug || null,
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
      const delivery = await sendWebPush(
        { patientId, phone },
        {
          title: "🔔 Thông báo trên điện thoại đã sẵn sàng",
          body: "Khi phòng khám xác nhận chốt lịch hoặc thay đổi giờ khám, thông báo sẽ hiện ngay trên thanh thông báo & màn hình thiết bị này.",
          url: "/lich-hen-cua-toi",
          type: "patient_test",
          requireInteraction: true,
        }
      );
      if (!delivery || delivery.sent === 0) {
        return res.status(400).json({
          success: false,
          error: 'Chưa tìm thấy thiết bị đăng ký Web Push cho số điện thoại này. Vui lòng bấm Bật ngay trước.',
        });
      }
      res.json({ success: true, sent: delivery.sent, message: 'Đã gửi thông báo thử nghiệm.' });
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

  // Android Digital Asset Links (Trusted Web Activity / APK URL verification)
  app.get("/.well-known/assetlinks.json", async (_req, res) => {
    try {
      const { db } = await import("./server/db/index.js");
      const { settings } = await import("./server/db/schema.js");
      const allSettings = await db.select().from(settings);
      const statements: any[] = [];
      const seenPackages = new Set<string>();

      for (const s of allSettings as any[]) {
        if ((s.id === "androidAppConfig" || s.key === "androidAppConfig") && s.value && typeof s.value === "object") {
          const val = s.value as any;
          const pkg = typeof val.packageName === "string" ? val.packageName.trim() : "";
          const rawFps = Array.isArray(val.sha256Fingerprints)
            ? val.sha256Fingerprints
            : typeof val.sha256Fingerprints === "string"
              ? val.sha256Fingerprints.split(/[\s,;]+/)
              : [];
          const fingerprints = Array.from(
            new Set(
              rawFps
                .map((fp: any) => String(fp || "").trim().toUpperCase())
                .filter((fp: string) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp))
            )
          );
          if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(pkg) && fingerprints.length > 0 && !seenPackages.has(pkg)) {
            seenPackages.add(pkg);
            statements.push({
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: pkg,
                sha256_cert_fingerprints: fingerprints,
              },
            });
          }
        }
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(statements);
    } catch (err) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json([]);
    }
  });

  // Direct internal short links: /b/:slug and /s/:slug -> /booking/:slug?mode=customer
  app.get(["/b/:slug", "/s/:slug"], (req, res) => {
    const slug = encodeURIComponent(req.params.slug);
    const queryIndex = req.originalUrl.indexOf("?");
    let queryString = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    if (!queryString) {
      queryString = "?mode=customer";
    } else if (!req.query.mode) {
      queryString += "&mode=customer";
    }
    res.redirect(302, `/booking/${slug}${queryString}`);
  });

  // ==========================================
  // STATIC ASSETS OR VITE MIDDLEWARE
  // ==========================================
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
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
