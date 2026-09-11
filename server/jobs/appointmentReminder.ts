import cron from "node-cron";
import { db } from "../db/index.js";
import { appointments } from "../db/schema.js";
import { and, gte, lte, eq } from "drizzle-orm";
import { remindPatientAppointment } from "../services/patientNotification.js";
import { addHours, subMinutes, addMinutes } from "date-fns";

let reminderCronJob: cron.ScheduledTask | null = null;

// Lập lịch chạy mỗi 15 phút (*/15 * * * *)
// Sẽ tìm các cuộc hẹn diễn ra sau đúng 24 giờ
export function initReminderCronJob() {
  if (reminderCronJob) return;

  reminderCronJob = cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("[ReminderCron] Bắt đầu quét lịch hẹn ngày mai...");
      
      const now = new Date();
      // Target window is 24 hours from now
      const targetTime = addHours(now, 24);
      
      // Chúng ta quét những lịch hẹn nằm trong khoảng 24h sắp tới (có dung sai +- 15p)
      const windowStart = subMinutes(targetTime, 15);
      const windowEnd = addMinutes(targetTime, 15);

      // Select appointments mapped to this 30 min window and status = CONFIRMED
      const apts = await db.select({
        id: appointments.id,
        startAt: appointments.startAt
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "CONFIRMED"),
          gte(appointments.startAt, windowStart),
          lte(appointments.startAt, windowEnd)
        )
      );

      if (apts.length > 0) {
        console.log(`[ReminderCron] Tìm thấy ${apts.length} lịch hẹn cần gửi nhắc nhở.`);
        
        for (const apt of apts) {
          // Send reminder
          console.log(`[ReminderCron] Gửi nhắc nhở cho lịch hẹn ${apt.id}...`);
          await remindPatientAppointment(apt.id);
        }
      } else {
        console.log("[ReminderCron] Không có lịch hẹn nào cần nhắc nhở trong khung giờ này.");
      }
    } catch (error) {
      console.error("[ReminderCron] Lỗi khi chạy cron job:", error);
    }
  });

  console.log("[ReminderCron] Đã khởi tạo tiến trình nhắc nhở tự động 24h (chạy mỗi 15 phút)");
}
