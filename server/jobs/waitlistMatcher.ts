import { db } from "../db/index.js";
import { waitlist } from "../db/schema.js";
import { sendWebPush } from "../services/notification.js";
import { eq, and, sql, or, isNull } from "drizzle-orm";

/**
 * ENGINE: WAITLIST MATCHER
 * Kích hoạt khi có một lịch hẹn bị HỦY (CANCELLED)
 */
export async function triggerWaitlistMatching(cancelledAppointment: any) {
  try {
    // 1. Tìm những bệnh nhân trong Waitlist có nhu cầu phù hợp với Slot vừa hủy
    // (Cùng Service, cùng Bác sĩ nếu có yêu cầu)
    
    const conditions = [
      eq(waitlist.status, "WAITING"),
      eq(waitlist.serviceId, cancelledAppointment.serviceId)
    ];

    if (cancelledAppointment.providerId) {
      conditions.push(sql`${waitlist.providerId} IS NULL OR ${waitlist.providerId} = ${cancelledAppointment.providerId}`);
    }

    const matches = await db.select().from(waitlist).where(and(...conditions)).orderBy(waitlist.createdAt).limit(5);

    if (matches.length === 0) {
      return; // Không có ai trong Waitlist khớp
    }

    // 2. Gửi Web Push Offer cho ứng cử viên đầu tiên (Top 1)
    const topCandidate = matches[0];
    
    // Cập nhật trạng thái thành OFFERED
    await db.update(waitlist)
      .set({ status: "OFFERED" })
      .where(eq(waitlist.id, topCandidate.id));

    // Gửi Push Notification
    await sendWebPush(topCandidate.patientId, {
      title: "Có lịch trống cho bạn!",
      body: "Một lịch hẹn bạn đang chờ vừa trống. Hãy bấm vào đây để đặt ngay.",
      url: `/book?waitlist=${topCandidate.id}`
    });

    console.log(`[Waitlist] Đã gửi offer cho patient: ${topCandidate.patientId}`);
  } catch (error) {
    console.error("[Waitlist] Lỗi:", error);
  }
}
