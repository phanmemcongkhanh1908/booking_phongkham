import webpush from "web-push";
import { db } from "../db/index.js";
import { pushSubscriptions, appointments, patients, services, providers, settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { safeFormatDate } from "../utils/dateFormat.js";

// Configured VAPID Keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "Tqn3SBNkFGIiSf6uGoGvpDfZXjH1XDesiM9XA5nTiZU";
const VAPID_SUBJECT = "mailto:admin@dentalsmartbooking.com";

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log("[WebPush] VAPID configuration initialized.");
} catch (error) {
  console.warn("Chưa cấu hình VAPID keys thật. Web Push sẽ không hoạt động trên môi trường thật.", error);
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  appointmentId?: string;
}

export async function sendWebPush(
  target: string | { patientId?: string; phone?: string },
  message: PushMessage
) {
  try {
    const patientId = typeof target === "string" ? target : target.patientId;
    let phone = typeof target === "object" ? target.phone : undefined;

    const subs: any[] = [];

    // 1. Fetch subscriptions linked to patientId
    if (patientId) {
      const byPatient = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.patientId, patientId));
      subs.push(...byPatient);

      // Also get phone from patient record if not provided
      if (!phone) {
        const pt = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
        if (pt.length > 0 && pt[0].phone) {
          phone = pt[0].phone;
        }
      }
    }

    // 2. Fetch subscriptions linked to patient phone
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const byPhone = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.phone, cleanPhone));
      subs.push(...byPhone);
      // Also check exact string match
      if (cleanPhone !== phone) {
        const byExactPhone = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.phone, phone));
        subs.push(...byExactPhone);
      }
    }

    // 3. Deduplicate subscriptions by endpoint
    const uniqueSubsMap = new Map<string, any>();
    for (const sub of subs) {
      if (sub && sub.endpoint && !uniqueSubsMap.has(sub.endpoint)) {
        uniqueSubsMap.set(sub.endpoint, sub);
      }
    }

    const uniqueSubs = Array.from(uniqueSubsMap.values());
    if (uniqueSubs.length === 0) {
      console.log(`[WebPush] No active push subscription for patientId=${patientId || "none"}, phone=${phone || "none"}`);
      return;
    }

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url || "/lich-hen-cua-toi",
      icon: message.icon || "/icon-192x192.png",
      badge: message.badge || "/icon-192x192.png",
      tag: message.tag || (message.appointmentId ? `apt-${message.appointmentId}` : "dental-smart-push"),
      timestamp: Date.now(),
    });

    const sendPromises = uniqueSubs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          // Subscription expired or unregistered by user -> remove from db
          try {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          } catch (delErr) {}
        } else {
          console.warn("[WebPush] Delivery warning:", err?.message || err);
        }
      }
    });

    await Promise.all(sendPromises);
    console.log(`[WebPush] Sent notification "${message.title}" to ${uniqueSubs.length} device(s).`);
  } catch (error) {
    console.error("[WebPush] Lỗi Notification Engine:", error);
  }
}

/**
 * Gửi Web Push tự động cho bệnh nhân khi lịch hẹn được XÁC NHẬN hoặc THAY ĐỔI TRẠNG THÁI
 */
export async function sendAppointmentStatusPush(
  appointmentId: string,
  newStatus: string,
  options?: {
    cancelReason?: string;
    oldStartAt?: any;
    newStartAt?: any;
  }
) {
  try {
    const aptList = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        status: appointments.status,
        patientId: appointments.patientId,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        serviceName: services.name,
        providerName: providers.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (aptList.length === 0) return;
    const apt = aptList[0];

    // Get Clinic Profile
    let clinicName = "Nha Khoa Dental Smart";
    try {
      const settingRes = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
      if (settingRes.length > 0 && typeof settingRes[0].value === "object" && (settingRes[0].value as any).clinicName) {
        clinicName = (settingRes[0].value as any).clinicName;
      }
    } catch (e) {}

    const timeStart = options?.newStartAt ? new Date(options.newStartAt) : apt.startAt;
    const timeStr = safeFormatDate(timeStart, "HH:mm - EEEE, dd/MM/yyyy");
    const serviceTitle = apt.serviceName || "Khám nha khoa";
    const doctorTitle = apt.providerName ? `Bác sĩ ${apt.providerName}` : "Bác sĩ chuyên khoa";

    let title = "";
    let body = "";

    const normalizedStatus = (newStatus || "").toUpperCase();

    switch (normalizedStatus) {
      case "CONFIRMED":
        title = "✅ Lịch khám đã được xác nhận";
        body = `Lịch hẹn khám ${serviceTitle} của bạn vào lúc ${timeStr} tại ${clinicName} đã được xác nhận thành công.`;
        break;

      case "CANCEL_CLINIC":
      case "CANCEL_PATIENT":
      case "CANCELLED":
        title = "❌ Thông báo hủy lịch hẹn";
        body = `Lịch hẹn khám ${serviceTitle} vào lúc ${timeStr} đã được hủy.${options?.cancelReason ? " Lý do: " + options.cancelReason : ""}`;
        break;

      case "RESCHEDULED":
      case "TIME_CHANGED":
        title = "⏰ Cập nhật thời gian khám mới";
        body = `Lịch hẹn khám ${serviceTitle} của bạn đã được chuyển sang ${timeStr}. Vui lòng sắp xếp thời gian đến đúng giờ!`;
        break;

      case "CHECKED_IN":
        title = "📋 Đã tiếp nhận tại phòng khám";
        body = `Quý khách đã làm thủ tục check-in tại ${clinicName}. ${doctorTitle} sẽ tiếp đón bạn trong ít phút.`;
        break;

      case "IN_PROGRESS":
        title = "🦷 Đang tiến hành khám điều trị";
        body = `Buổi khám ${serviceTitle} cùng ${doctorTitle} đang diễn ra. Chúc bạn có trải nghiệm êm ái!`;
        break;

      case "COMPLETED":
        title = "🌟 Hoàn tất buổi khám điều trị";
        body = `Buổi khám ${serviceTitle} đã hoàn tất. Cảm ơn bạn đã tin tưởng dịch vụ tại ${clinicName}!`;
        break;

      case "NO_SHOW":
        title = "⚠️ Thông báo lỡ hẹn khám";
        body = `Hệ thống ghi nhận bạn chưa thể đến khám lúc ${timeStr}. Bạn có thể đặt lại lịch hẹn bất cứ khi nào tại website.`;
        break;

      case "REQUESTED":
      case "PENDING":
        title = "📋 Đã tiếp nhận yêu cầu đặt lịch";
        body = `Yêu cầu đặt hẹn khám ${serviceTitle} lúc ${timeStr} đang chờ phòng khám duyệt và xác nhận.`;
        break;

      default:
        title = "🔔 Cập nhật trạng thái lịch hẹn";
        body = `Lịch hẹn khám ${serviceTitle} vào lúc ${timeStr} vừa được cập nhật trạng thái: ${newStatus}.`;
        break;
    }

    const targetUrl = apt.patientPhone 
      ? `/lich-hen-cua-toi?phone=${encodeURIComponent(apt.patientPhone)}`
      : "/lich-hen-cua-toi";

    await sendWebPush(
      {
        patientId: apt.patientId || undefined,
        phone: apt.patientPhone || undefined,
      },
      {
        title,
        body,
        url: targetUrl,
        appointmentId: apt.id,
      }
    );
  } catch (err) {
    console.error("[WebPush] Lỗi gửi thông báo trạng thái lịch hẹn:", err);
  }
}
