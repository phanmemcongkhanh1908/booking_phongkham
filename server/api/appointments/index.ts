import { Router } from "express";
import { db } from "../../db/index.js";
import { appointments, patients, providers, services, settings } from "../../db/schema.js";
import { sendPatientReminder } from "../../core/telegram.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { AppointmentQuerySchema, UpdateStatusSchema } from "../../../shared/appointment.js";
import { NotFoundError, BadRequestError } from "../../core/errors.js";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import { sendWebPush } from "../../services/notification.js";
import { triggerWaitlistMatching } from "../../jobs/waitlistMatcher.js";
import { generateRecall } from "../../jobs/recallGenerator.js";
import { notifyPatientAppointment } from "../../services/patientNotification.js";

const appointmentRouter = Router();

// Middleware yêu cầu đăng nhập cho toàn bộ Router này
appointmentRouter.use(requireAuth);

// [M03, M06] Lấy danh sách Lịch hẹn cho Calendar (Receptionist / Dentist)
appointmentRouter.get("/", requirePermission("appointment.view"), async (req, res, next) => {
  try {
    const query = AppointmentQuerySchema.parse(req.query);
    const conditions = [];

    if (query.startDate) {
      conditions.push(gte(appointments.startAt, startOfDay(parseISO(query.startDate))));
    }
    if (query.endDate) {
      conditions.push(lte(appointments.endAt, endOfDay(parseISO(query.endDate))));
    }
    if (query.providerId) {
      conditions.push(eq(appointments.providerId, query.providerId));
    }
    if (query.status) {
      conditions.push(eq(appointments.status, query.status));
    }

    const results = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        source: appointments.source,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        debt: patients.debt,
        allergies: patients.allergies,
        lastXRayDate: patients.lastXRayDate,
        providerId: providers.id,
        providerName: providers.name,
        serviceId: services.id,
        serviceName: services.name,
        durationMins: services.durationMins,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(appointments.startAt);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

// Helper: Kiểm tra tính hợp lệ của State Machine
const isValidTransition = (current: string, next: string): boolean => {
  const allowedTransitions: Record<string, string[]> = {
    "PENDING": ["REQUESTED", "CONFIRMED", "CANCEL_PATIENT", "CANCEL_CLINIC"],
    "REQUESTED": ["CONFIRMED", "CANCEL_CLINIC", "CANCEL_PATIENT"],
    "CONFIRMED": ["CHECKED_IN", "NO_SHOW", "CANCEL_PATIENT", "CANCEL_CLINIC", "RESCHEDULED"],
    "CHECKED_IN": ["IN_SERVICE", "CANCEL_PATIENT", "CANCEL_CLINIC"],
    "IN_SERVICE": ["COMPLETED"],
    "COMPLETED": [],
    "CANCEL_PATIENT": [],
    "CANCEL_CLINIC": [],
    "RESCHEDULED": [],
    "NO_SHOW": [],
  };

  const allowed = allowedTransitions[current] || [];
  return allowed.includes(next);
};

// [M02] Đặt lịch trực tiếp (Admin/Receptionist)
appointmentRouter.post("/next", requirePermission("appointment.create"), async (req, res, next) => {
  try {
    const { patientId, providerId, serviceId, startAt, endAt, notes } = req.body;
    if (!patientId || !providerId || !serviceId || !startAt || !endAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc");
    }

    const newAppointment = await db.insert(appointments).values({
      patientId,
      providerId,
      serviceId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status: "CONFIRMED", // Admin đặt thì mặc định confirm luôn
      notes: notes || "Đặt lịch hẹn tiếp theo bởi Admin",
      source: "CLINIC"
    }).returning();

    res.json({ success: true, data: newAppointment[0] });
  } catch (error) {
    next(error);
  }
});

// [M02] Cập nhật thời gian Lịch hẹn (Kéo thả)
appointmentRouter.patch("/:id/time", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const { startAt, endAt } = req.body;
    const updated = await db.update(appointments)
      .set({ 
        startAt: new Date(startAt), 
        endAt: new Date(endAt),
        updatedAt: new Date()
      })
      .where(eq(appointments.id, req.params.id))
      .returning();
    
    if (updated.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

// [M02] Cập nhật trạng thái Lịch hẹn (Confirm, Check-in, Complete)
appointmentRouter.patch("/:id/status", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { status: nextStatus } = UpdateStatusSchema.parse(req.body);

    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const currentStatus = existing[0].status;

    // Bỏ qua nếu trạng thái không thay đổi
    if (currentStatus === nextStatus) {
      return res.json({ success: true, data: existing[0] });
    }

    // Validate State Machine
    if (!isValidTransition(currentStatus, nextStatus)) {
      throw new BadRequestError(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`);
    }

    const updated = await db.update(appointments)
      .set({ 
        status: nextStatus, 
        updatedAt: new Date() 
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    const appointment = updated[0];

    // Notification Engine, Waitlist & Recall Triggers
    if (nextStatus === "CONFIRMED") {
      await sendWebPush(appointment.patientId, {
        title: "Lịch hẹn đã được xác nhận",
        body: `Lịch hẹn của bạn vào lúc ${format(appointment.startAt, "HH:mm dd/MM/yyyy")} đã được xác nhận.`,
      });
      // Tự động gửi thông báo qua Telegram và Email cho bệnh nhân
      notifyPatientAppointment(appointment.id, "CONFIRMED").catch(console.error);
    } else if (nextStatus === "COMPLETED") {
      // Trigger Recall Engine
      generateRecall(appointment).catch(console.error);
    } else if (nextStatus === "CANCEL_CLINIC" || nextStatus === "CANCEL_PATIENT") {
      if (nextStatus === "CANCEL_CLINIC") {
         await sendWebPush(appointment.patientId, {
          title: "Lịch hẹn đã bị hủy",
          body: `Lịch hẹn của bạn vào lúc ${format(appointment.startAt, "HH:mm dd/MM/yyyy")} đã bị hủy bởi phòng khám.`,
        });
      }
      // Tự động thông báo hủy qua Telegram / Email cho bệnh nhân
      notifyPatientAppointment(appointment.id, "CANCELLED").catch(console.error);
      
      // Trigger Waitlist Engine
      triggerWaitlistMatching(appointment).catch(console.error);
    }

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

// [M02] Gửi thông báo Telegram / Email thủ công cho bệnh nhân
appointmentRouter.post("/:id/notify-patient", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { event = "CONFIRMED" } = req.body;
    const result = await notifyPatientAppointment(appointmentId, event as any);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});


// [M02] Gửi tin nhắn nhắc lịch (Telegram)
appointmentRouter.post("/:id/remind", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const results = await db
      .select({
        startAt: appointments.startAt,
        patientName: patients.fullName,
        telegramId: patients.telegramId,
        serviceName: services.name,
        providerName: providers.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const apt = results[0];
    if (!apt.telegramId) {
      return res.status(400).json({ 
        success: false, 
        error: { message: "Khách hàng chưa được cấu hình Telegram ID. Vui lòng cập nhật ID của khách hàng để nhận tin nhắn qua bot." } 
      });
    }

    // Get clinic profile
    let clinicProfile = null;
    try {
      const dbSettings = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
      if (dbSettings.length > 0) clinicProfile = dbSettings[0].value;
    } catch(e) {}

    const success = await sendPatientReminder(apt.telegramId, apt, clinicProfile);
    
    if (success) {
      res.json({ success: true, message: "Đã gửi thông báo nhắc lịch thành công" });
    } else {
      res.status(500).json({ success: false, error: { message: "Không thể gửi tin nhắn. Hãy kiểm tra lại cấu hình Bot." } });
    }

  } catch (error) {
    next(error);
  }
});


// [M02] Sửa Lịch hẹn
appointmentRouter.put("/:id", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const { providerId, serviceId, startAt, endAt, notes } = req.body;
    
    const updated = await db.update(appointments)
      .set({
        providerId,
        serviceId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        notes,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, req.params.id))
      .returning();
      
    if (updated.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

// [M02] Xóa Lịch hẹn (Admin)
appointmentRouter.delete("/:id", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    await db.delete(appointments).where(eq(appointments.id, req.params.id));
    res.json({ success: true, message: "Đã xóa lịch hẹn" });
  } catch (error) {
    next(error);
  }
});

export default appointmentRouter;
