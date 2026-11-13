import { Router } from "express";
import { db } from "../../db/index.js";
import { pushSubscriptions } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { realtimeNotification } from "../../services/realtimeNotification.js";
import { sendAdminTestPush } from "../../services/notification.js";

const notificationRouter = Router();

const SubscribeSchema = z.object({
  patientId: z.string().uuid("ID Bệnh nhân không hợp lệ"),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

notificationRouter.post("/subscribe", requireAuth, async (req, res, next) => {
  try {
    const data = SubscribeSchema.parse(req.body);

    // Kiểm tra xem subscription đã tồn tại chưa
    const existing = await db.select().from(pushSubscriptions).where(
      and(
        eq(pushSubscriptions.patientId, data.patientId),
        eq(pushSubscriptions.endpoint, data.subscription.endpoint)
      )
    ).limit(1);

    if (existing.length === 0) {
      await db.insert(pushSubscriptions).values({
        patientId: data.patientId,
        endpoint: data.subscription.endpoint,
        p256dh: data.subscription.keys.p256dh,
        auth: data.subscription.keys.auth,
      });
    }

    res.json({ success: true, message: "Đăng ký nhận thông báo thành công" });
  } catch (error) {
    next(error);
  }
});

const AdminSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  deviceLabel: z.string().optional(),
  notifyPopup: z.boolean().optional(),
  notifySound: z.boolean().optional(),
});

notificationRouter.get("/vapid-key", (req, res) => {
  res.json({
    success: true,
    publicKey:
      process.env.VAPID_PUBLIC_KEY ||
      "BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk",
  });
});

notificationRouter.post(
  "/admin/subscribe",
  requireAuth,
  requirePermission("appointment.view"),
  async (req, res, next) => {
    try {
      const data = AdminSubscribeSchema.parse(req.body);
      const userId = req.user?.userId || "";
      const tenantId = req.user?.tenantId ? String(req.user.tenantId).trim() : null;

      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, data.subscription.endpoint))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(pushSubscriptions)
          .set({
            subscriberType: "admin",
            userId,
            tenantId,
            p256dh: data.subscription.keys.p256dh,
            auth: data.subscription.keys.auth,
            deviceLabel: data.deviceLabel || existing[0].deviceLabel || "Mobile Admin",
            notifyPopup: data.notifyPopup ?? true,
            notifySound: data.notifySound ?? true,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          id: "adm_sub_" + Math.random().toString(36).substring(2, 12),
          subscriberType: "admin",
          userId,
          tenantId,
          endpoint: data.subscription.endpoint,
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          deviceLabel: data.deviceLabel || "Mobile Admin",
          notifyPopup: data.notifyPopup ?? true,
          notifySound: data.notifySound ?? true,
          createdAt: new Date(),
        });
      }

      res.json({ success: true, message: "Đã bật nhận thông báo đặt lịch trên thiết bị quản lý" });
    } catch (error) {
      next(error);
    }
  }
);

notificationRouter.post("/admin/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint;
    if (endpoint && typeof endpoint === "string") {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
    res.json({ success: true, message: "Đã tắt thông báo đẩy trên thiết bị này" });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post(
  "/admin/test-push",
  requireAuth,
  requirePermission("appointment.view"),
  async (req, res, next) => {
    try {
      const userId = req.user?.userId || "";
      const tenantId = req.user?.tenantId ? String(req.user.tenantId).trim() : null;
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : undefined;
      const result = await sendAdminTestPush(userId, tenantId, endpoint);
      if (result.sent === 0) {
        return res.status(400).json({
          success: false,
          error: { message: "Thiết bị chưa bật quyền nhận Thông báo đẩy (Push). Vui lòng bấm Bật thông báo trước." },
        });
      }
      res.json({ success: true, data: result, message: "Đã gửi thông báo đẩy thử nghiệm tới thiết bị!" });
    } catch (error) {
      next(error);
    }
  }
);

// SSE endpoint for admin real-time notifications
notificationRouter.get("/stream", requireAuth, requirePermission("appointment.view"), (req, res) => {
  realtimeNotification.addClient(req, res);
});

export default notificationRouter;
