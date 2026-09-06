import { Router } from "express";
import { db } from "../../db/index.js";
import { pushSubscriptions } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../core/middleware.js";

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

export default notificationRouter;
