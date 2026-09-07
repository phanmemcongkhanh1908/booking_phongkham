import nodemailer from "nodemailer";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { safeFormatDate } from "../utils/dateFormat.js";

export interface EmailConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  let dbConfig: Partial<EmailConfig> = {};
  try {
    const res = await db.select().from(settings).where(eq(settings.id, "emailConfig")).limit(1);
    if (res.length > 0 && typeof res[0].value === "object" && res[0].value !== null) {
      dbConfig = res[0].value as Partial<EmailConfig>;
    }
  } catch (e) {
    console.error("Error reading emailConfig from DB:", e);
  }

  const host = dbConfig.host || process.env.SMTP_HOST || "";
  const port = Number(dbConfig.port || process.env.SMTP_PORT || 587);
  const secure = dbConfig.secure !== undefined ? dbConfig.secure : (process.env.SMTP_SECURE === "true" || port === 465);
  const user = dbConfig.user || process.env.SMTP_USER || "";
  const pass = dbConfig.pass || process.env.SMTP_PASS || "";
  const from = dbConfig.from || process.env.SMTP_FROM || (user ? `Dental Smart Booking <${user}>` : "");
  const enabled = dbConfig.enabled !== undefined ? dbConfig.enabled : (Boolean(host && user && pass));

  return {
    enabled,
    host,
    port,
    secure,
    user,
    pass,
    from
  };
}

export function createTransporter(config: EmailConfig) {
  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

export async function testSmtpConnection(config: EmailConfig, testRecipient?: string) {
  const transporter = createTransporter(config);
  if (!transporter) {
    throw new Error("Chưa điền đủ thông tin SMTP (Máy chủ Host, Tài khoản User, Mật khẩu Pass).");
  }

  // Verify connection configuration
  await transporter.verify();

  // If a test recipient is given, send a verification email
  if (testRecipient) {
    await transporter.sendMail({
      from: config.from || config.user,
      to: testRecipient,
      subject: "✅ [Dental Smart Booking] Kiểm tra cấu hình Email thành công",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0EA5A4; color: #ffffff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">Dental Smart Booking</h2>
            <p style="margin: 6px 0 0 0; opacity: 0.9;">Kiểm tra hệ thống gửi Email thông báo</p>
          </div>
          <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 16px; margin-top: 0;">Xin chào,</p>
            <p>Email này được gửi tự động để kiểm tra kết nối SMTP giữa phòng khám nha khoa và máy chủ gửi thư.</p>
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <strong style="color: #047857;">Kết nối SMTP thành công!</strong>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #065f46;">
                Hệ thống đã sẵn sàng gửi thư xác nhận và thông báo lịch hẹn tự động cho bệnh nhân.
              </p>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; pt: 16px;">
              Thời gian gửi: ${format(new Date(), "HH:mm:ss dd/MM/yyyy")}
            </p>
          </div>
        </div>
      `
    });
  }

  return true;
}

export interface AppointmentNotificationData {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  serviceName: string;
  providerName?: string;
  startAt: Date;
  status: string;
  notes?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
}

export async function sendPatientAppointmentEmail(
  type: "CREATED" | "CONFIRMED" | "CANCELLED",
  data: AppointmentNotificationData
): Promise<boolean> {
  if (!data.patientEmail) {
    return false;
  }

  const config = await getEmailConfig();
  if (!config.enabled || !config.host || !config.user || !config.pass) {
    console.log("[Email Service] SMTP chưa được bật hoặc chưa cấu hình đủ. Bỏ qua gửi email.");
    return false;
  }

  const transporter = createTransporter(config);
  if (!transporter) return false;

  const clinicName = data.clinicName || "Phòng khám Nha Khoa Smart Dental";
  const clinicPhone = data.clinicPhone || "1900 xxxx";
  const clinicAddress = data.clinicAddress || "Tại phòng khám";
  const formattedTime = safeFormatDate(data.startAt, "HH:mm - EEEE, 'ngày' dd/MM/yyyy");

  let subject = "";
  let bannerColor = "#0EA5A4";
  let statusBadge = "";
  let messageIntro = "";

  if (type === "CONFIRMED") {
    subject = `✅ [Xác nhận thành công] Lịch hẹn khám tại ${clinicName}`;
    bannerColor = "#0EA5A4";
    statusBadge = `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">ĐÃ XÁC NHẬN</span>`;
    messageIntro = `Lịch hẹn khám của quý khách đã được <strong>xác nhận thành công</strong>. Chúng tôi rất hân hạnh được đón tiếp quý khách!`;
  } else if (type === "CREATED") {
    subject = `📋 [Đã tiếp nhận] Lịch hẹn khám tại ${clinicName}`;
    bannerColor = "#2563EB";
    statusBadge = `<span style="background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">ĐANG XỬ LÝ</span>`;
    messageIntro = `Hệ thống đã ghi nhận yêu cầu đặt lịch hẹn của quý khách. Bộ phận lễ tân sẽ liên hệ hoặc xác nhận trong thời gian sớm nhất.`;
  } else {
    subject = `⚠️ [Thông báo hủy] Lịch hẹn khám tại ${clinicName}`;
    bannerColor = "#DC2626";
    statusBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px;">ĐÃ HỦY</span>`;
    messageIntro = `Lịch hẹn khám của quý khách đã được hủy bỏ theo yêu cầu hoặc lịch làm việc của phòng khám.`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background-color: ${bannerColor}; color: #ffffff; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">${clinicName}</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Hệ Thống Đặt Lịch & Chăm Sóc Nha Khoa Thông Minh</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
          <div style="margin-bottom: 24px; text-align: center;">
            ${statusBadge}
          </div>

          <p style="font-size: 16px; margin-top: 0; line-height: 1.6;">
            Kính gửi <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">
            ${messageIntro}
          </p>

          <!-- Appointment Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #0EA5A4; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              🦷 THÔNG TIN LỊCH HẸN
            </h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.8;">
              <tr>
                <td style="color: #64748b; width: 140px; padding: 4px 0;">Mã lịch hẹn:</td>
                <td style="font-weight: 600; color: #0f172a; font-family: monospace;">#${data.appointmentId.slice(0, 8).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Thời gian khám:</td>
                <td style="font-weight: 600; color: #0f172a;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Dịch vụ nha khoa:</td>
                <td style="font-weight: 600; color: #0f172a;">${data.serviceName}</td>
              </tr>
              ${data.providerName ? `
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Bác sĩ phụ trách:</td>
                <td style="font-weight: 600; color: #0f172a;">👨‍⚕️ ${data.providerName}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Số điện thoại:</td>
                <td style="color: #0f172a;">${data.patientPhone}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Địa chỉ khám:</td>
                <td style="color: #0f172a;">📍 ${clinicAddress}</td>
              </tr>
              ${data.notes ? `
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Ghi chú / Triệu chứng:</td>
                <td style="color: #475569; font-style: italic;">"${data.notes}"</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Important Note -->
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e; line-height: 1.5;">
            <strong>💡 Lưu ý dành cho quý khách:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
              <li>Quý khách vui lòng đến trước giờ hẹn <strong>5 - 10 phút</strong> để hoàn tất thủ tục lễ tân nhanh chóng.</li>
              <li>Nếu quý khách có nhu cầu đổi giờ hoặc hủy hẹn, vui lòng liên hệ sớm qua hotline để được hỗ trợ tốt nhất.</li>
            </ul>
          </div>

          <!-- Contact Footer -->
          <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">
            <p style="margin: 0 0 6px 0;">Cần hỗ trợ gấp? Gọi ngay hotline: <strong style="color: #0EA5A4;">${clinicPhone}</strong></p>
            <p style="margin: 0; font-size: 12px;">Email này được gửi tự động từ hệ thống quản lý phòng khám ${clinicName}.</p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: config.from || config.user,
      to: data.patientEmail,
      subject,
      html
    });
    console.log(`[Email Service] Đã gửi email (${type}) thành công tới: ${data.patientEmail}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Lỗi gửi email tới ${data.patientEmail}:`, error);
    return false;
  }
}
