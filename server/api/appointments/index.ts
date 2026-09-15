import { Router } from "express";
import { db } from "../../db/index.js";
import { appointments, patients, providers, services, settings } from "../../db/schema.js";
import { sendPatientReminder } from "../../core/telegram.js";
import { eq, and, gte, lte, or, like, desc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { AppointmentQuerySchema, UpdateStatusSchema } from "../../../shared/appointment.js";
import { NotFoundError, BadRequestError } from "../../core/errors.js";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import { safeFormatDate } from "../../utils/dateFormat.js";
import { sendWebPush } from "../../services/notification.js";
import { triggerWaitlistMatching } from "../../jobs/waitlistMatcher.js";
import { generateRecall } from "../../jobs/recallGenerator.js";
import { getProviderOccupiedSlots, isSlotConflict } from "../../core/scheduling.js";
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
    "PENDING": ["REQUESTED", "CONFIRMED", "CHECKED_IN", "CANCEL_PATIENT", "CANCEL_CLINIC"],
    "REQUESTED": ["CONFIRMED", "CHECKED_IN", "CANCEL_CLINIC", "CANCEL_PATIENT"],
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

// Tra cứu nhanh lịch hẹn cho Check-in (theo ID hoặc số điện thoại)
appointmentRouter.get("/lookup/:term", requirePermission("appointment.view"), async (req, res, next) => {
  try {
    const term = req.params.term.trim();
    if (!term) {
      return res.json({ success: true, data: [] });
    }

    const cleanTerm = term.replace(/\D/g, '');

    const conditions = [
      eq(appointments.id, term),
      like(appointments.id, `%${term}%`)
    ];

    if (cleanTerm.length >= 3) {
      conditions.push(like(patients.phone, `%${cleanTerm}%`));
    }
    if (term.length >= 2) {
      conditions.push(like(patients.fullName, `%${term}%`));
    }

    const results = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        providerName: providers.name,
        serviceName: services.name,
        price: services.price,
        durationMins: services.durationMins,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(or(...conditions))
      .orderBy(desc(appointments.startAt))
      .limit(10);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

// Lấy chi tiết 1 lịch hẹn theo ID
appointmentRouter.get("/detail/:id", requirePermission("appointment.view"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const results = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        debt: patients.debt,
        allergies: patients.allergies,
        providerName: providers.name,
        serviceName: services.name,
        price: services.price,
        durationMins: services.durationMins,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, id))
      .limit(1);

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }

    res.json({ success: true, data: results[0] });
  } catch (error) {
    next(error);
  }
});

// [M02] Đặt lịch trực tiếp (Admin/Receptionist)
appointmentRouter.post("/next", requirePermission("appointment.create"), async (req, res, next) => {
  try {
    let { patientId, providerId, serviceId, startAt, endAt, notes } = req.body;
    if (!patientId || !serviceId || !startAt || !endAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc");
    }

    if (!providerId || providerId === 'default') {
      const providerRecords = await db.select().from(providers).limit(1);
      if (providerRecords.length > 0) {
        providerId = providerRecords[0].id;
      } else {
        throw new BadRequestError("Không có bác sĩ nào trong hệ thống");
      }
    }
    const occupiedSlots = await getProviderOccupiedSlots(providerId, new Date(startAt));
    if (isSlotConflict(new Date(startAt), new Date(endAt), occupiedSlots)) {
      throw new BadRequestError("Khung giờ này đã bị đụng lịch. Vui lòng chọn giờ khác.");
    }

    const newAppointment = await db.insert(appointments).values({
      patientId,
      providerId,
      serviceId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status: "CONFIRMED",
      notes: notes || "Đặt lịch hẹn tiếp theo bởi Admin",
      source: "CLINIC"
    }).returning();

    res.json({ success: true, data: newAppointment[0] });
  } catch (error) {
    next(error);
  }
});

// Quick / Direct book from Admin or Calendar
appointmentRouter.post("/quick", requirePermission("appointment.create"), async (req, res, next) => {
  try {
    const { 
      patientName, 
      phone, 
      serviceId, 
      providerId: reqProviderId, 
      startAt, 
      endAt: reqEndAt, 
      notes, 
      status: reqStatus, 
      force,
      patientId: reqPatientId
    } = req.body;

    if (!patientName || !phone || !serviceId || !startAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc (Họ tên, Số điện thoại, Dịch vụ, Thời gian bắt đầu)");
    }

    const bookingResult = await db.transaction(async (tx) => {
      let patientId = reqPatientId;

      if (!patientId) {
        const cleanPhone = phone.replace(/\D/g, '');
        let patientRecords = await tx.select().from(patients).where(eq(patients.phone, cleanPhone)).limit(1);

        if (patientRecords.length === 0) {
          const newPatient = await tx.insert(patients).values({
            fullName: patientName.trim(),
            phone: cleanPhone,
          }).returning();
          patientId = newPatient[0].id;
        } else {
          patientId = patientRecords[0].id;
          if (patientName.trim() && patientRecords[0].fullName !== patientName.trim()) {
            await tx.update(patients).set({ fullName: patientName.trim() }).where(eq(patients.id, patientId));
          }
        }
      }

      // Determine Provider
      let chosenProviderId = reqProviderId;
      if (!chosenProviderId || chosenProviderId === 'default' || chosenProviderId === 'auto') {
        const providerRecords = await tx.select().from(providers).where(eq(providers.isActive, true)).limit(1);
        if (providerRecords.length > 0) {
          chosenProviderId = providerRecords[0].id;
        } else {
          const anyProviders = await tx.select().from(providers).limit(1);
          if (anyProviders.length > 0) {
            chosenProviderId = anyProviders[0].id;
          } else {
            throw new BadRequestError("Không có bác sĩ nào trong hệ thống");
          }
        }
      } else {
        // Validate provider exists
        const checkPrv = await tx.select().from(providers).where(eq(providers.id, chosenProviderId)).limit(1);
        if (checkPrv.length === 0) {
          const fallbackPrv = await tx.select().from(providers).limit(1);
          if (fallbackPrv.length > 0) chosenProviderId = fallbackPrv[0].id;
        }
      }

      // Determine endAt if not provided
      let finalEndAt = reqEndAt ? new Date(reqEndAt) : null;
      if (!finalEndAt || isNaN(finalEndAt.getTime())) {
        const serviceRec = await tx.select().from(services).where(eq(services.id, serviceId)).limit(1);
        const durationMins = (serviceRec.length > 0 && serviceRec[0].durationMins) ? serviceRec[0].durationMins : 30;
        finalEndAt = new Date(new Date(startAt).getTime() + durationMins * 60000);
      }

      const finalStartAt = new Date(startAt);

      if (!force) {
        const occupiedSlots = await getProviderOccupiedSlots(chosenProviderId, finalStartAt);
        if (isSlotConflict(finalStartAt, finalEndAt, occupiedSlots)) {
          throw new BadRequestError("Khung giờ này đã bị đụng lịch với lịch hẹn khác của Bác sĩ. Vui lòng chọn giờ khác hoặc bật xác nhận đè lịch.");
        }
      }

      const initialStatus = reqStatus === "REQUESTED" ? "REQUESTED" : "CONFIRMED";

      const newAppointment = await tx.insert(appointments).values({
        patientId,
        providerId: chosenProviderId,
        serviceId,
        startAt: finalStartAt,
        endAt: finalEndAt,
        status: initialStatus,
        notes: notes ? notes.trim() : "Đặt lịch bởi Quản trị viên/Lễ tân",
        source: "CLINIC"
      }).returning();
      
      return newAppointment[0];
    });

    // Notify patient if created with CONFIRMED status
    if (bookingResult.status === "CONFIRMED") {
      const timeStr = safeFormatDate(bookingResult.startAt, "HH:mm dd/MM/yyyy");
      sendWebPush(bookingResult.patientId, {
        title: "Lịch hẹn mới đã được xác nhận",
        body: `Lịch hẹn của bạn vào lúc ${timeStr} đã được lên lịch thành công.`,
      }).catch(console.error);
      notifyPatientAppointment(bookingResult.id, "CONFIRMED").catch(console.error);
    }

    res.json({ success: true, data: bookingResult });
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
    const { status: nextStatus, cancelReason } = UpdateStatusSchema.parse(req.body);

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

    const updateData: any = { status: nextStatus, updatedAt: new Date() };
    if (cancelReason && nextStatus === "CANCEL_CLINIC") {
      updateData.cancelReason = cancelReason;
    }
    const updated = await db.update(appointments)
      .set(updateData)
      .where(eq(appointments.id, appointmentId))
      .returning();

    const appointment = updated[0];

    // Notification Engine, Waitlist & Recall Triggers
    if (nextStatus === "CONFIRMED") {
      const timeStr = safeFormatDate(appointment.startAt, "HH:mm dd/MM/yyyy");
      await sendWebPush(appointment.patientId, {
        title: "Lịch hẹn đã được xác nhận",
        body: `Lịch hẹn của bạn vào lúc ${timeStr} đã được xác nhận.`,
      });
      // Tự động gửi thông báo qua Telegram và Email cho bệnh nhân
      notifyPatientAppointment(appointment.id, "CONFIRMED").catch(console.error);
    } else if (nextStatus === "COMPLETED") {
      // Trigger Recall Engine
      generateRecall(appointment).catch(console.error);
    } else if (nextStatus === "CANCEL_CLINIC" || nextStatus === "CANCEL_PATIENT") {
      if (nextStatus === "CANCEL_CLINIC") {
        const timeStr = safeFormatDate(appointment.startAt, "HH:mm dd/MM/yyyy");
        await sendWebPush(appointment.patientId, {
          title: "Lịch hẹn đã bị hủy",
          body: `Lịch hẹn của bạn vào lúc ${timeStr} đã bị hủy. ${cancelReason ? 'Lý do: ' + cancelReason : ''}`,
        });
      }
      // Tự động thông báo hủy qua Telegram / Email cho bệnh nhân
      notifyPatientAppointment(appointment.id, "CANCELLED", cancelReason).catch(console.error);
      
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
