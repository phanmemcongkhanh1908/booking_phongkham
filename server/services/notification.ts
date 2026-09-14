import webpush from "web-push";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Sinh cặp key: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "Tqn3SBNkFGIiSf6uGoGvpDfZXjH1XDesiM9XA5nTiZU";
const VAPID_SUBJECT = "mailto:admin@dentalsmartbooking.com";

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (error) {
  console.warn("Chưa cấu hình VAPID keys thật. Web Push sẽ không hoạt động trên môi trường thật.", error);
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendWebPush(patientId: string, message: PushMessage) {
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.patientId, patientId));
    
    if (subs.length === 0) {
      return; // Không có thiết bị đăng ký nhận push
    }

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url || "/",
      icon: message.icon || "/icon-192x192.png",
    });

    const sendPromises = subs.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };
      
      return webpush.sendNotification(pushSubscription, payload).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription đã hết hạn hoặc không tồn tại, cần xóa
          return db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
        console.error("Lỗi gửi Web Push:", err);
      });
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error("Lỗi Notification Engine:", error);
  }
}
