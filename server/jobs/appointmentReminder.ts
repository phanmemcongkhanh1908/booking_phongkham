import cron from "node-cron";
import { db } from "../db/index.js";
import { appointments } from "../db/schema.js";
import { and, gte, lte, eq, isNull } from "drizzle-orm";
import { remindPatientAppointment } from "../services/patientNotification.js";
import { sendWebPush } from "../services/notification.js";
import { checkExpiredWaitlistOffers } from "./waitlistMatcher.js";
import { safeFormatDate } from "../utils/dateFormat.js";
import { addHours, subMinutes, addMinutes } from "date-fns";
import { appContext } from "../core/context.js";
import {
  syncConfirmedAppointmentsToFirestore,
  fetchUpcomingConfirmedAppointmentsFromFirestore,
  fetchUpcomingConfirmedAppointmentsFor24hFromFirestore,
  markOneHourReminderSent,
  mark24HourReminderSent,
} from "../services/appointmentFirestoreService.js";

let reminder24hCronJob: any | null = null;
let reminder1hCronJob: any | null = null;

/**
 * Quét các lịch hẹn diễn ra sau ~24 giờ để nhắc lịch qua Email / Telegram / Push
 */
export async function run24HourReminderSweep(now = new Date()) {
  try {
    await checkExpiredWaitlistOffers();
    await syncConfirmedAppointmentsToFirestore();

    const targetTime = addHours(now, 24);
    const windowStart = subMinutes(targetTime, 30); // +23h30p từ hiện tại
    const windowEnd = addMinutes(targetTime, 30);   // +24h30p từ hiện tại

    const { source, items } = await fetchUpcomingConfirmedAppointmentsFor24hFromFirestore(windowStart, windowEnd);

    if (items.length === 0) {
      return 0;
    }

    console.log(`[ReminderCron][24h] (${source}) Tìm thấy ${items.length} lịch hẹn ngày mai cần gửi nhắc nhở trước 24 giờ.`);

    let sentCount = 0;
    for (const apt of items) {
      try {
        const res = await remindPatientAppointment(apt.id);
        if (!res.webPushSent) {
          const startTimeStr = safeFormatDate(apt.startAt, "HH:mm - dd/MM/yyyy");
          const startHourStr = safeFormatDate(apt.startAt, "HH:mm");
          const baseBookingUrl = apt.clinicSlug
            ? `/b/${encodeURIComponent(apt.clinicSlug)}/lich-hen`
            : "/lich-hen-cua-toi";
          const targetUrl = `${baseBookingUrl}?highlightAppointmentId=${encodeURIComponent(apt.id)}${
            apt.patientPhone ? `&phone=${encodeURIComponent(apt.patientPhone)}` : ""
          }`;

          await sendWebPush(
            {
              patientId: apt.patientId || undefined,
              phone: apt.patientPhone || undefined,
            },
            {
              title: `📅 Nhắc lịch hẹn ngày mai lúc ${startHourStr} tại ${apt.clinicName}`,
              body: `Còn 24 giờ nữa đến lịch khám ${apt.serviceName}${
                apt.providerName ? ` với ${apt.providerName}` : ""
              } (${startTimeStr}). Vui lòng đến đúng giờ nhé!`,
              url: targetUrl,
              icon: "/pwa-192x192.png",
              tag: `24h-reminder-${apt.id}`,
              appointmentId: apt.id,
              type: "appointment_24h_reminder",
              status: "CONFIRMED",
              clinicName: apt.clinicName,
              clinicSlug: apt.clinicSlug || null,
              serviceName: apt.serviceName,
              providerName: apt.providerName || undefined,
              patientName: apt.patientName,
              startAt: apt.startAt,
              endAt: apt.endAt,
              tenantId: apt.tenantId || null,
              requireInteraction: true,
            }
          );
        }

        await mark24HourReminderSent(apt.id, new Date());
        sentCount++;
      } catch (err) {
        console.error(`[ReminderCron][24h] Lỗi gửi nhắc lịch 24h cho lịch hẹn ${apt.id}:`, err);
      }
    }

    return sentCount;
  } catch (error) {
    console.error("[ReminderCron][24h] Lỗi khi quét lịch hẹn 24h:", error);
    return 0;
  }
}

/**
 * Quét danh sách lịch hẹn CONFIRMED trong Firestore (khung [now + 45p, now + 75p] — trước giờ hẹn ~1 giờ)
 * và tự động gửi Web Push Notification đến thiết bị khách hàng đã đăng ký.
 */
export async function runOneHourReminderSweep(now = new Date()) {
  try {
    // Đảm bảo dữ liệu lịch hẹn CONFIRMED mới nhất đã được đồng bộ lên Firestore
    await syncConfirmedAppointmentsToFirestore();

    const targetTime = addMinutes(now, 60);
    const windowStart = subMinutes(targetTime, 15); // +45 phút từ hiện tại
    const windowEnd = addMinutes(targetTime, 15);   // +75 phút từ hiện tại

    const { source, items } = await fetchUpcomingConfirmedAppointmentsFromFirestore(windowStart, windowEnd);

    if (items.length === 0) {
      return { source, processed: 0 };
    }

    console.log(`[ReminderCron][1h] (${source}) Tìm thấy ${items.length} lịch hẹn sắp diễn ra sau ~1 giờ cần gửi Web Push.`);

    let sentCount = 0;
    for (const apt of items) {
      try {
        const startTimeStr = safeFormatDate(apt.startAt, "HH:mm - dd/MM/yyyy");
        const startHourStr = safeFormatDate(apt.startAt, "HH:mm");
        const baseBookingUrl = apt.clinicSlug
          ? `/b/${encodeURIComponent(apt.clinicSlug)}/lich-hen`
          : "/lich-hen-cua-toi";
        const targetUrl = `${baseBookingUrl}?highlightAppointmentId=${encodeURIComponent(apt.id)}${apt.patientPhone ? `&phone=${encodeURIComponent(apt.patientPhone)}` : ""}`;

        await sendWebPush(
          {
            patientId: apt.patientId || undefined,
            phone: apt.patientPhone || undefined,
          },
          {
            title: `⏰ Nhắc lịch hẹn lúc ${startHourStr} tại ${apt.clinicName}`,
            body: `Còn khoảng 1 giờ nữa đến lịch khám ${apt.serviceName}${apt.providerName ? ` với ${apt.providerName}` : ""} (${startTimeStr}). Vui lòng đến đúng giờ nhé!`,
            url: targetUrl,
            tag: `1h-reminder-${apt.id}`,
            appointmentId: apt.id,
            type: "appointment_1h_reminder",
            status: "CONFIRMED",
            clinicName: apt.clinicName,
            clinicSlug: apt.clinicSlug || null,
            serviceName: apt.serviceName,
            providerName: apt.providerName || undefined,
            patientName: apt.patientName,
            startAt: apt.startAt,
            endAt: apt.endAt,
            tenantId: apt.tenantId || null,
            requireInteraction: true,
          }
        );

        await markOneHourReminderSent(apt.id, new Date());
        sentCount++;
      } catch (err) {
        console.error(`[ReminderCron][1h] Lỗi gửi Web Push cho lịch hẹn ${apt.id}:`, err);
      }
    }

    return { source, processed: sentCount };
  } catch (error) {
    console.error("[ReminderCron][1h] Lỗi khi chạy cron nhắc lịch trước 1 giờ:", error);
    return { source: "error", processed: 0 };
  }
}

export function initReminderCronJob() {
  if (!reminder24hCronJob) {
    reminder24hCronJob = cron.schedule("*/15 * * * *", async () => {
      console.log("[ReminderCron][24h] Bắt đầu quét lịch hẹn ngày mai...");
      await run24HourReminderSweep();
    });
    console.log("[ReminderCron][24h] Đã khởi tạo tiến trình nhắc nhở tự động 24h via Service Worker (mỗi 15 phút)");

    setTimeout(() => {
      run24HourReminderSweep().catch(() => {});
    }, 8000);
  }

  if (!reminder1hCronJob) {
    reminder1hCronJob = cron.schedule("*/5 * * * *", async () => {
      await runOneHourReminderSweep();
    });
    console.log("[ReminderCron][1h] Đã khởi tạo tiến trình Web Push nhắc lịch tự động trước 1 giờ từ Firestore (mỗi 5 phút)");

    // Chạy 1 lượt đồng bộ + quét nhẹ sau khi server khởi động 5 giây (không block startup)
    setTimeout(() => {
      runOneHourReminderSweep().catch(() => {});
    }, 5000);
  }
}
