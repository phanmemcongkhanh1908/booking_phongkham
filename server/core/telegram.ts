import { db } from "../db/index.js";
import { appointments, patients, services, providers, settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import TelegramBot from "node-telegram-bot-api";

let bot: any = null;
let currentChatId: string | null = null;
let botUsername: string = "";

async function getSetting(id: string) {
  const res = await db.select().from(settings).where(eq(settings.id, id)).limit(1);
  return res.length > 0 ? (res[0].value as string) : null;
}

export function getTelegramBotInstance() {
  return bot;
}

export async function getTelegramBotUsername(): Promise<string> {
  if (botUsername) return botUsername;
  const configured = await getSetting("telegramBotUsername") || process.env.TELEGRAM_BOT_USERNAME || "";
  if (configured) {
    botUsername = configured.replace(/^@/, "");
    return botUsername;
  }
  if (bot) {
    try {
      const me = await bot.getMe();
      if (me && me.username) {
        botUsername = me.username;
        return botUsername;
      }
    } catch (e) {
      // ignore
    }
  }
  return "";
}

export async function reloadBotConfig(token?: string, chatId?: string, username?: string) {
  if (bot) {
    try {
      bot.stopPolling();
    } catch (e) {}
    bot = null;
  }
  
  const finalToken = token || await getSetting('telegramToken') || process.env.TELEGRAM_BOT_TOKEN;
  currentChatId = chatId || await getSetting('telegramChatId') || process.env.TELEGRAM_ADMIN_CHAT_ID;
  const finalUsername = username || await getSetting('telegramBotUsername') || process.env.TELEGRAM_BOT_USERNAME || "";
  if (finalUsername) {
    botUsername = finalUsername.replace(/^@/, "");
  }

  if (finalToken) {
    try {
      bot = new TelegramBot(finalToken, { polling: true });
      console.log("Telegram Bot started. Polling enabled.");

      bot.on('polling_error', (error: any) => {
        if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
          console.warn('⚠️ [Telegram] Polling conflict (409). Another instance of this bot is already running. Stopping polling on this instance to prevent crashes.');
          bot.stopPolling();
        } else {
          console.error('[Telegram] Polling error:', error);
        }
      });

      // Try to fetch bot username if not set
      bot.getMe().then((me: any) => {
        if (me && me.username) {
          botUsername = me.username;
          console.log(`[Telegram Bot] Connected as @${me.username}`);
        }
      }).catch((err: any) => console.warn("Could not getMe from Telegram:", err.message));

      // Handle patient & admin messages
      bot.on('message', async (msg: any) => {
        const text = (msg.text || "").trim();
        const chatIdStr = msg.chat.id.toString();

        // 1. Check if message is a deep link: /start apt_<appointmentId>
        const aptMatch = text.match(/^\/start\s+apt_([a-zA-Z0-9_-]+)/i);
        if (aptMatch) {
          const appointmentId = aptMatch[1];
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

            if (aptList.length > 0) {
              const apt = aptList[0];
              // Update patient's telegramId
              await db.update(patients)
                .set({ telegramId: chatIdStr, updatedAt: new Date() })
                .where(eq(patients.id, apt.patientId));

              const { savePatientContact } = await import("../services/patientContact.js");
              await savePatientContact(apt.patientId, apt.patientPhone || "", { telegramId: chatIdStr });

              const timeStr = format(apt.startAt, "HH:mm - EEEE, dd/MM/yyyy");
              const welcomeMsg = 
                `🎉 *XÁC THỰC TELEGRAM THÀNH CÔNG!*\n\n` +
                `Xin chào *${apt.patientName}*, bạn đã kết nối nhận thông báo từ phòng khám nha khoa Dental Smart.\n\n` +
                `🦷 *Dịch vụ:* ${apt.serviceName}\n` +
                `👨‍⚕️ *Bác sĩ:* ${apt.providerName || "Bác sĩ chuyên khoa"}\n` +
                `⏰ *Thời gian khám:* ${timeStr}\n` +
                `📌 *Trạng thái:* ${apt.status === "CONFIRMED" ? "✅ Đã xác nhận" : "⏳ Đang chờ xác nhận"}\n\n` +
                `Mọi thông báo cập nhật, xác nhận hoặc nhắc lịch sẽ được gửi tự động tới Telegram này của bạn!`;

              await bot.sendMessage(chatIdStr, welcomeMsg, { parse_mode: "Markdown" });
              return;
            }
          } catch (err) {
            console.error("Error linking patient telegram via deep link:", err);
          }
        }

        // 2. Check if user sent phone number or /start <phone>
        const phoneMatch = text.match(/(?:^\/start\s+)?(0[3|5|7|8|9][0-9]{8})/);
        if (phoneMatch) {
          const phone = phoneMatch[1];
          try {
            const foundPatients = await db.select().from(patients).where(eq(patients.phone, phone)).limit(1);
            if (foundPatients.length > 0) {
              const p = foundPatients[0];
              await db.update(patients).set({ telegramId: chatIdStr, updatedAt: new Date() }).where(eq(patients.id, p.id));
              
              const { savePatientContact } = await import("../services/patientContact.js");
              await savePatientContact(p.id, phone, { telegramId: chatIdStr });

              await bot.sendMessage(chatIdStr, `✅ Đã liên kết số điện thoại *${phone}* (${p.fullName}) với tài khoản Telegram này. Bạn sẽ nhận được các thông báo lịch hẹn tại đây!`, { parse_mode: "Markdown" });
              return;
            }
          } catch (err) {
            console.error("Error linking phone with telegram:", err);
          }
        }

        // 3. Regular messages
        if (chatIdStr !== currentChatId) {
          if (text.startsWith("/start") || text.toLowerCase() === "help") {
            await bot.sendMessage(chatIdStr, 
              `👋 Xin chào!\n\n` +
              `Đây là kênh thông báo tự động của phòng khám nha khoa *Dental Smart*.\n` +
              `Để kết nối nhận thông báo lịch hẹn, bạn có thể:\n` +
              `1. Đặt lịch trên website và bấm nút "Nhận thông báo Telegram".\n` +
              `2. Hoặc gửi tin nhắn số điện thoại đã đăng ký đặt hẹn (VD: 0912345678) cho bot.\n\n` +
              `_Chat ID của bạn:_ \`${chatIdStr}\``,
              { parse_mode: "Markdown" }
            );
          } else {
            console.log(`[Telegram] Message from unknown chat ID ${chatIdStr}: "${text}"`);
          }
        }
      });

      // Handle Callback Query (Admin confirmation / cancellation)
      
      bot.on('callback_query', async (query: any) => {
        if (!query.data || !query.message) return;
        
        if (currentChatId && query.message.chat.id.toString() !== currentChatId.toString()) {
           await bot?.answerCallbackQuery(query.id, { text: 'Bạn không có quyền thực hiện thao tác này.', show_alert: true });
           return;
        }
        
        const [action, appointmentId] = query.data.split('_');

        try {
          if (action === 'CONFIRM' || action === 'CANCEL') {
            const nextStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'CANCEL_CLINIC';
            
            const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
            if (existing.length === 0) return;
            
            // Basic validity check (cannot confirm/cancel completed or already cancelled appts)
            if (['COMPLETED', 'CANCELLED', 'CANCEL_CLINIC', 'CANCEL_PATIENT', 'NO_SHOW'].includes(existing[0].status)) {
               await bot?.answerCallbackQuery(query.id, { text: 'Lịch hẹn đã kết thúc hoặc đã hủy trước đó.', show_alert: true });
               return;
            }

            
            await db.update(appointments)
              .set({ status: nextStatus, updatedAt: new Date() })
              .where(eq(appointments.id, appointmentId));

            const text = action === 'CONFIRM' ? '✅ Đã xác nhận lịch hẹn.' : '❌ Đã hủy lịch hẹn.';
            await bot?.answerCallbackQuery(query.id, { text });
            await bot?.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id
            });
            await bot?.sendMessage(query.message.chat.id, text, {
              reply_to_message_id: query.message.message_id
            });

            // Automatically notify patient about confirmation / cancellation!
            const { notifyPatientAppointment } = await import("../services/patientNotification.js");
            notifyPatientAppointment(appointmentId, nextStatus === "CONFIRMED" ? "CONFIRMED" : "CANCELLED").catch(console.error);
          }
        } catch (error) {
          console.error("Telegram callback error:", error);
          bot?.answerCallbackQuery(query.id, { text: 'Có lỗi xảy ra, vui lòng kiểm tra Dashboard.' });
        }
      });
    } catch (e) {
      console.error("Error starting Telegram bot:", e);
    }
  }
}

async function initBot() {
  await reloadBotConfig();
}

initBot().catch(console.error);

export const sendNewAppointmentAlert = async (appointmentId: string) => {
  if (!bot || !currentChatId) return;
  const chatId = currentChatId;

  try {
    const results = await db
      .select({
        startAt: appointments.startAt,
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

    if (results.length === 0) return;
    const apt = results[0];

    const message = `🔔 *CÓ LỊCH HẸN MỚI!*\n\n`
      + `👤 Khách hàng: ${apt.patientName}\n`
      + `📞 SĐT: ${apt.patientPhone}\n`
      + `🦷 Dịch vụ: ${apt.serviceName}\n`
      + `👨‍⚕️ Bác sĩ: ${apt.providerName}\n`
      + `⏰ Thời gian: ${format(apt.startAt, "HH:mm dd/MM/yyyy")}\n\n`
      + `Vui lòng xác nhận hoặc hủy lịch hẹn này.`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Xác nhận', callback_data: `CONFIRM_${appointmentId}` },
          { text: '❌ Hủy', callback_data: `CANCEL_${appointmentId}` }
        ]
      ]
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
  }
};

export const sendPatientReminder = async (telegramId: string, appointmentData: any, clinicData: any) => {
  if (!bot || !telegramId) return false;
  try {
    const clinicName = clinicData?.clinicName || "Phòng khám nha khoa";
    const hotline = clinicData?.phone || "";
    
    const message = `🔔 *THÔNG BÁO NHẮC LỊCH HẸN*\n\n`
      + `Kính gửi quý khách *${appointmentData.patientName}*,\n`
      + `${clinicName} xin nhắc lịch hẹn của quý khách:\n\n`
      + `🦷 *Dịch vụ:* ${appointmentData.serviceName}\n`
      + `👨‍⚕️ *Bác sĩ:* ${appointmentData.providerName}\n`
      + `⏰ *Thời gian:* ${format(appointmentData.startAt, "HH:mm dd/MM/yyyy")}\n\n`
      + `Rất mong quý khách sắp xếp thời gian đến đúng giờ. Nếu cần hỗ trợ, vui lòng liên hệ ${hotline}.\n`
      + `Trân trọng!`;

    await bot.sendMessage(telegramId, message, {
      parse_mode: 'Markdown'
    });
    return true;
  } catch (error) {
    console.error("Failed to send Telegram reminder to patient:", error);
    return false;
  }
};
export const sendPatientDocument = async (telegramId: string, buffer: Buffer, filename: string, caption?: string) => {
  if (!bot || !telegramId) return false;
  try {
    const fileOptions = {
      filename,
      contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'image/png'
    };
    await bot.sendDocument(telegramId, buffer, { caption, parse_mode: 'Markdown' }, fileOptions);
    return true;
  } catch (error) {
    console.error("Failed to send Document to Telegram:", error);
    return false;
  }
};
