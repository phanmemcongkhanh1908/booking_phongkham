import { db } from "../db/index.js";
import { appointments, patients, services, providers, settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { sendPatientAppointmentEmail, AppointmentNotificationData } from "./email.js";
import { getPatientContact } from "./patientContact.js";
import { sendWebPush } from "./notification.js";
import { getTelegramBotInstance } from "../core/telegram.js";

export interface NotificationResult {
  telegramSent: boolean;
  emailSent: boolean;
  webPushSent: boolean;
  patientEmail?: string;
  patientTelegramId?: string;
  errors: string[];
}

export async function notifyPatientAppointment(
  appointmentId: string,
  event: "CREATED" | "CONFIRMED" | "CANCELLED"
): Promise<NotificationResult> {
  const result: NotificationResult = {
    telegramSent: false,
    emailSent: false,
    webPushSent: false,
    errors: [],
  };

  try {
    const aptRecords = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        status: appointments.status,
        notes: appointments.notes,
        patientId: appointments.patientId,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientTelegramId: patients.telegramId,
        serviceName: services.name,
        providerName: providers.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (aptRecords.length === 0) {
      result.errors.push("Không tìm thấy thông tin lịch hẹn");
      return result;
    }

    const apt = aptRecords[0];

    // Load clinic profile from settings
    let clinicProfile: any = {
      clinicName: "Nha Khoa Dental Smart",
      doctorName: "Bác sĩ chuyên khoa",
      address: "Phòng khám nha khoa",
      phone: "Hotline phòng khám",
    };

    try {
      const settingRes = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
      if (settingRes.length > 0 && typeof settingRes[0].value === "object") {
        clinicProfile = { ...clinicProfile, ...settingRes[0].value };
      }
    } catch (e) {
      console.warn("Could not read clinicProfile settings:", e);
    }

    // Get contact info (Email and Telegram ID)
    const contact = await getPatientContact(apt.patientId, apt.patientPhone || undefined);
    const email = contact.email;
    const telegramId = contact.telegramId || apt.patientTelegramId;

    result.patientEmail = email;
    result.patientTelegramId = telegramId;

    const notificationPayload: AppointmentNotificationData = {
      appointmentId: apt.id,
      patientName: apt.patientName || "Quý khách",
      patientPhone: apt.patientPhone || "",
      patientEmail: email,
      serviceName: apt.serviceName || "Khám nha khoa",
      providerName: apt.providerName || clinicProfile.doctorName,
      startAt: apt.startAt,
      status: apt.status,
      notes: apt.notes || undefined,
      clinicName: clinicProfile.clinicName,
      clinicAddress: clinicProfile.address,
      clinicPhone: clinicProfile.phone,
    };

    // 1. Send EMAIL if email is available
    if (email) {
      try {
        const emailSuccess = await sendPatientAppointmentEmail(event, notificationPayload);
        result.emailSent = emailSuccess;
      } catch (err: any) {
        console.error("Error sending patient email:", err);
        result.errors.push(`Email error: ${err.message}`);
      }
    }

    // 2. Send TELEGRAM if telegramId is available
    if (telegramId) {
      try {
        const bot = getTelegramBotInstance();
        if (bot) {
          const timeStr = format(apt.startAt, "HH:mm - EEEE, dd/MM/yyyy");
          let tgHeader = "";
          if (event === "CONFIRMED") {
            tgHeader = "✅ *LỊCH HẸN ĐÃ ĐƯỢC XÁC NHẬN THÀNH CÔNG*";
          } else if (event === "CREATED") {
            tgHeader = "📋 *ĐÃ TIẾP NHẬN YÊU CẦU ĐẶT LỊCH HẸN*";
          } else {
            tgHeader = "❌ *THÔNG BÁO HỦY LỊCH HẸN*";
          }

          const tgMessage = 
            `${tgHeader}\n\n` +
            `Kính gửi *${apt.patientName}*,\n` +
            (event === "CONFIRMED" 
              ? `Lịch hẹn khám nha khoa của bạn tại *${clinicProfile.clinicName}* đã được xác nhận:\n\n`
              : event === "CREATED"
              ? `Yêu cầu đặt lịch hẹn của bạn tại *${clinicProfile.clinicName}* đã được ghi nhận:\n\n`
              : `Lịch hẹn của bạn tại *${clinicProfile.clinicName}* đã được hủy.\n\n`) +
            `🦷 *Dịch vụ:* ${apt.serviceName}\n` +
            `👨‍⚕️ *Bác sĩ:* ${apt.providerName || clinicProfile.doctorName}\n` +
            `⏰ *Thời gian:* ${timeStr}\n` +
            `📍 *Địa chỉ:* ${clinicProfile.address}\n` +
            `📞 *Hotline:* ${clinicProfile.phone}\n` +
            (apt.notes ? `📝 *Ghi chú:* _${apt.notes}_\n` : "") +
            `\n💡 _Vui lòng đến trước 5-10 phút để được phục vụ chu đáo nhất!_`;

          await bot.sendMessage(telegramId, tgMessage, { parse_mode: "Markdown" });
          result.telegramSent = true;
          console.log(`[Telegram Service] Sent patient notification (${event}) to chatId: ${telegramId}`);
        }
      } catch (err: any) {
        console.error("Error sending patient Telegram message:", err);
        result.errors.push(`Telegram error: ${err.message}`);
      }
    }

    // 3. Send WEB PUSH
    if (apt.patientId) {
      try {
        const pushTitle = event === "CONFIRMED" 
          ? "Lịch hẹn đã được xác nhận"
          : event === "CREATED" 
          ? "Đã tiếp nhận yêu cầu đặt lịch"
          : "Lịch hẹn đã bị hủy";
        
        const pushBody = `Khám ${apt.serviceName} vào lúc ${format(apt.startAt, "HH:mm dd/MM/yyyy")}`;

        await sendWebPush(apt.patientId, {
          title: pushTitle,
          body: pushBody,
          url: `/book`
        });
        result.webPushSent = true;
      } catch (err: any) {
        console.warn("Web Push error:", err);
      }
    }

  } catch (err: any) {
    console.error("Critical error in notifyPatientAppointment:", err);
    result.errors.push(err.message);
  }

  return result;
}
