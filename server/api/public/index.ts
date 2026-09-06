import { Router } from "express";
import { z } from "zod";
import { calculateAvailableSlots } from "../../core/scheduling.js";
import { parseISO, addMinutes, addDays, format, startOfToday } from "date-fns";
import crypto from "crypto";
import { db } from "../../db/index.js";
import { appointmentHolds, appointments, patients, services, providers } from "../../db/schema.js";
import { HoldSlotSchema, BookAppointmentSchema } from "../../../shared/schemas.js";
import { eq, and, gte, lt, gt, sql } from "drizzle-orm";
import { ConflictError, BadRequestError, NotFoundError, ForbiddenError } from "../../core/errors.js";
import { sendNewAppointmentAlert, getTelegramBotUsername } from "../../core/telegram.js";
import { notifyPatientAppointment } from "../../services/patientNotification.js";
import { savePatientContact } from "../../services/patientContact.js";

const publicRouter = Router();

publicRouter.get("/services", async (req, res, next) => {
  try {
    const allServices = await db.select().from(services);
    res.json({ success: true, data: allServices });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/providers", async (req, res, next) => {
  try {
    const allProviders = await db.select().from(providers);
    res.json({ success: true, data: allProviders });
  } catch (error) {
    next(error);
  }
});

const AvailabilityQuerySchema = z.object({
  providerId: z.string().uuid("ID Bác sĩ không hợp lệ").optional(),
  serviceId: z.string().uuid("ID Dịch vụ không hợp lệ"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD"),
});

const AvailabilitySummaryQuerySchema = z.object({
  providerId: z.string().uuid("ID Bác sĩ không hợp lệ").optional(),
  serviceId: z.string().uuid("ID Dịch vụ không hợp lệ"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD").optional(),
  days: z.coerce.number().min(1).max(60).optional().default(28),
});

// [M01] Tóm tắt 28 ngày để hiển thị thanh chọn ngày với trạng thái Còn chỗ / Hết chỗ
publicRouter.get("/availability/summary", async (req, res, next) => {
  try {
    const query = AvailabilitySummaryQuerySchema.parse(req.query);
    const start = query.startDate ? parseISO(query.startDate) : startOfToday();
    const daysCount = query.days || 28;

    let providerId = query.providerId;
    if (!providerId) {
      const activeProviders = await db.select().from(providers).where(eq(providers.isActive, true)).limit(1);
      if (activeProviders.length === 0) {
        return res.json({ success: true, data: { summary: [], nextAvailableDate: null, nextAvailableCount: 0 } });
      }
      providerId = activeProviders[0].id;
    }

    const dayPromises = Array.from({ length: daysCount }).map(async (_, idx) => {
      const targetDate = addDays(start, idx);
      const dateStr = format(targetDate, "yyyy-MM-dd");
      const availableSlots = await calculateAvailableSlots(
        providerId!,
        query.serviceId,
        targetDate,
        { includeUnavailable: false }
      );
      const count = availableSlots.length;
      return {
        date: dateStr,
        dayOfWeek: targetDate.getDay(),
        availableSlotsCount: count,
        isFull: count === 0,
      };
    });

    const summary = await Promise.all(dayPromises);
    const nextAvailable = summary.find(s => !s.isFull);

    res.json({
      success: true,
      data: {
        summary,
        nextAvailableDate: nextAvailable ? nextAvailable.date : null,
        nextAvailableCount: nextAvailable ? nextAvailable.availableSlotsCount : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// [M01] Lấy danh sách Slot rảnh & bận (để làm mờ khung giờ đã full)
publicRouter.get("/availability", async (req, res, next) => {
  try {
    const query = AvailabilityQuerySchema.parse(req.query);
    const targetDate = parseISO(query.date);

    let providerId = query.providerId;

    if (!providerId) {
      // Pick the first active provider
      const activeProviders = await db.select().from(providers).where(eq(providers.isActive, true)).limit(1);
      if (activeProviders.length === 0) {
        throw new NotFoundError("Không có bác sĩ nào đang hoạt động");
      }
      providerId = activeProviders[0].id;
    }

    const includeUnavailable = req.query.includeUnavailable !== "false";

    const availableSlots = await calculateAvailableSlots(
      providerId,
      query.serviceId,
      targetDate,
      { includeUnavailable }
    );

    res.json({
      success: true,
      data: availableSlots,
    });
  } catch (error) {
    next(error);
  }
});

// [M01] Giữ chỗ (Hold Slot) 5 phút
publicRouter.post("/appointments/hold", async (req, res, next) => {
  try {
    const data = HoldSlotSchema.parse(req.body);
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    const expiresAt = addMinutes(new Date(), 5); // Hold 5 mins

    // SERIALIZABLE Transaction to prevent double holding
    const holdResult = await db.transaction(async (tx) => {
      // Check if slot is still available
      const conflictingBookings = await tx.select().from(appointments).where(
        and(
          eq(appointments.providerId, data.providerId),
          lt(appointments.startAt, endAt),
          gt(appointments.endAt, startAt),
          sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC')`
        )
      );

      const conflictingHolds = await tx.select().from(appointmentHolds).where(
        and(
          eq(appointmentHolds.providerId, data.providerId),
          gte(appointmentHolds.expiresAt, new Date()), // only active holds
          lt(appointmentHolds.startAt, endAt),
          gt(appointmentHolds.endAt, startAt)
        )
      );

      if (conflictingBookings.length > 0 || conflictingHolds.length > 0) {
        throw new ConflictError("Rất tiếc, giờ này vừa được đặt bởi người khác. Vui lòng chọn giờ khác.");
      }

      const sessionToken = crypto.randomUUID();

      const newHold = await tx.insert(appointmentHolds).values({
        sessionToken,
        providerId: data.providerId,
        serviceId: data.serviceId,
        startAt,
        endAt,
        expiresAt,
      }).returning();

      return newHold[0];
    }, { isolationLevel: "serializable" });

    res.json({
      success: true,
      data: {
        sessionToken: holdResult.sessionToken,
        expiresAt: holdResult.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// [M01] Xác nhận đặt lịch chính thức
publicRouter.post("/appointments", async (req, res, next) => {
  try {
    const data = BookAppointmentSchema.parse(req.body);

    const bookingResult = await db.transaction(async (tx) => {
      // 1. Verify the hold session
      const holds = await tx.select().from(appointmentHolds).where(
        eq(appointmentHolds.sessionToken, data.sessionToken)
      ).limit(1);

      if (holds.length === 0) {
        throw new NotFoundError("Không tìm thấy phiên giữ chỗ");
      }

      const hold = holds[0];
      if (hold.expiresAt < new Date()) {
        throw new BadRequestError("Phiên giữ chỗ đã hết hạn. Vui lòng chọn lại giờ.");
      }

      // Check if providerId is null
      if (!hold.providerId) {
          throw new BadRequestError("Thiếu ID bác sĩ trong phiên giữ chỗ");
      }

      // 2. Find or Create Patient
      let patientRecords = await tx.select().from(patients).where(eq(patients.phone, data.phone)).limit(1);
      let patientId;

      
      let patientNotes = data.notes;
      if (data.email) {
        patientNotes = data.notes ? (data.notes + ' | Email: ' + data.email) : ('Email: ' + data.email);
      }
      
      // Merge with existing JSON if it exists
      if (patientRecords.length > 0 && patientRecords[0].notes) {
        try {
          const parsed = JSON.parse(patientRecords[0].notes);
          if (patientNotes) {
            parsed.text = (parsed.text ? parsed.text + '\n' : '') + patientNotes;
          }
          patientNotes = JSON.stringify(parsed);
        } catch (e) {
           // Not JSON, just append
           patientNotes = patientRecords[0].notes + (patientNotes ? '\n' + patientNotes : '');
        }
      } else if (patientNotes) {
         // Create new JSON format
         patientNotes = JSON.stringify({ text: patientNotes, diagnosis: '', treatmentPlan: '', documents: [] });
      }


      if (patientRecords.length > 0) {
        patientId = patientRecords[0].id;
        // Update patient info if provided
        await tx.update(patients).set({
          fullName: data.fullName,
          dob: data.dob || patientRecords[0].dob,
          gender: data.gender || patientRecords[0].gender,
          telegramId: data.telegramId || patientRecords[0].telegramId,
          notes: patientNotes || patientRecords[0].notes,
          updatedAt: new Date(),
        }).where(eq(patients.id, patientId));
      } else {
        const newPatient = await tx.insert(patients).values({
          fullName: data.fullName,
          phone: data.phone,
          dob: data.dob,
          gender: data.gender,
          telegramId: data.telegramId || undefined,
          notes: patientNotes,
        }).returning();
        patientId = newPatient[0].id;
      }

      // 3. Get Service Configuration (Auto Confirm?)
      const serviceRecords = await tx.select().from(services).where(eq(services.id, hold.serviceId)).limit(1);
      if (serviceRecords.length === 0) {
        throw new BadRequestError("Không tìm thấy dịch vụ");
      }
      
      const service = serviceRecords[0];
      const finalStatus = service.autoConfirm ? "CONFIRMED" : "REQUESTED";

      // 4. Create the Appointment
      const newAppointment = await tx.insert(appointments).values({
        patientId,
        providerId: hold.providerId,
        serviceId: hold.serviceId,
        startAt: hold.startAt,
        endAt: hold.endAt,
        status: finalStatus,
        notes: data.notes,
        source: "ONLINE"
      }).returning();

      // 5. Delete the hold session so it can't be reused
      await tx.delete(appointmentHolds).where(eq(appointmentHolds.id, hold.id));

      return newAppointment[0];
    }, { isolationLevel: "serializable" });

    // Save contact info mapping (email & telegramId)
    await savePatientContact(bookingResult.patientId, data.phone, {
      email: data.email,
      telegramId: data.telegramId,
    });

    // Send Telegram alert to clinic admin
    sendNewAppointmentAlert(bookingResult.id).catch(console.error);

    // Send automated notification to patient (Telegram and/or Email)
    const notificationEvent = bookingResult.status === "CONFIRMED" ? "CONFIRMED" : "CREATED";
    notifyPatientAppointment(bookingResult.id, notificationEvent).catch(console.error);

    const botUsername = await getTelegramBotUsername();

    res.json({
      success: true,
      data: {
        appointmentId: bookingResult.id,
        status: bookingResult.status,
        patientEmail: data.email || null,
        patientTelegramId: data.telegramId || null,
        telegramBotUsername: botUsername,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint cho phép bệnh nhân đăng ký nhận email / liên kết telegram hoặc gửi lại thông báo

publicRouter.post("/appointments/:id/notify", async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { email, telegramId, phone } = req.body;

    if (!phone) {
      throw new BadRequestError("Vui lòng cung cấp số điện thoại để xác thực");
    }

    const aptList = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (aptList.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");
    const apt = aptList[0];

    const pList = await db.select().from(patients).where(eq(patients.id, apt.patientId)).limit(1);
    if (pList.length === 0) throw new NotFoundError("Không tìm thấy thông tin bệnh nhân");
    const patient = pList[0];
    
    // Verify phone number to prevent IDOR
    if (patient.phone !== phone) {
      throw new ForbiddenError("Xác thực số điện thoại không hợp lệ");
    }


    if (email || telegramId) {
      await savePatientContact(patient.id, patient.phone, { email, telegramId });
    }

    const event = apt.status === "CONFIRMED" ? "CONFIRMED" : "CREATED";
    const result = await notifyPatientAppointment(appointmentId, event);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Public endpoint lấy thông tin cơ bản phòng khám & bot username
publicRouter.get("/clinic-info", async (req, res, next) => {
  try {
    const { settings } = await import("../../db/schema.js");
    let settingRes = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
    if (settingRes.length === 0) {
      settingRes = await db.select().from(settings).where(eq(settings.id, "clinic_profile")).limit(1);
    }
    let clinicProfile = settingRes.length > 0 ? settingRes[0].value : null;
    if (typeof clinicProfile === "string") {
      try {
        clinicProfile = JSON.parse(clinicProfile);
      } catch (e) {
        // ignore JSON parse error
      }
    }
    if (clinicProfile && !clinicProfile.clinicName && clinicProfile.name) {
      clinicProfile.clinicName = clinicProfile.name;
    }
    const botUsername = await getTelegramBotUsername();

    res.json({
      success: true,
      data: {
        clinicProfile,
        telegramBotUsername: botUsername,
      }
    });
  } catch (error) {
    next(error);
  }
});


publicRouter.get("/appointments/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const results = await db
      .select({
        id: appointments.id,
        status: appointments.status,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        serviceName: services.name,
        providerName: providers.name,
        patientName: patients.fullName,
        patientPhone: patients.phone
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(patients, eq(appointments.patientId, patients.id))
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

export default publicRouter;
