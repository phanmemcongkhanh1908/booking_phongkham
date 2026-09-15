import { Router } from "express";
import { z } from "zod";
import { calculateAvailableSlots } from "../../core/scheduling.js";
import { parseISO, addMinutes, addDays, format, startOfToday } from "date-fns";
import crypto from "crypto";
import { db } from "../../db/index.js";
import { appointmentHolds, appointments, patients, services, providers } from "../../db/schema.js";
import { HoldSlotSchema, BookAppointmentSchema } from "../../../shared/schemas.js";
import { eq, and, gte, lt, gt, sql, inArray, desc } from "drizzle-orm";
import { ConflictError, BadRequestError, NotFoundError, ForbiddenError } from "../../core/errors.js";
import { sendNewAppointmentAlert, getTelegramBotUsername } from "../../core/telegram.js";
import { getProviderOccupiedSlots, isSlotConflict } from "../../core/scheduling.js";
import { notifyPatientAppointment } from "../../services/patientNotification.js";
import { savePatientContact } from "../../services/patientContact.js";
import { createRateLimiter } from "../../core/rateLimit.js";

// Rate limiters for public endpoints
const bookingHoldLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Bạn đã gửi quá nhiều yêu cầu đặt giữ chỗ. Vui lòng đợi 1 phút trước khi thử lại."
});

const patientVerifyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 12,
  message: "Quá nhiều yêu cầu kiểm tra hoặc xác thực thông tin. Vui lòng đợi 1 phút."
});

const appointmentLookupLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: "Quá nhiều yêu cầu tra cứu lịch hẹn. Vui lòng thử lại sau 1 phút."
});

import { appContext } from "../../core/context.js";
const publicRouter = Router();
publicRouter.use((req, res, next) => {
  const tenantId = req.headers["x-tenant-id"] || req.query.tenantId || null;
  appContext.run({ tenantId: tenantId as string | null }, () => {
    next();
  });
});

publicRouter.get("/services", async (req, res, next) => {
  try {
    const allServices = await db.select().from(services);
    // Filter active services in memory to gracefully handle older records where isActive might be missing
    const activeServices = allServices.filter((s: any) => s.isActive !== false);
    res.json({ success: true, data: activeServices });
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
      const allActiveProviders = await db.select().from(providers).where(eq(providers.isActive, true));
      if (allActiveProviders.length === 0) {
        return res.json({ success: true, data: { summary: [], nextAvailableDate: null, nextAvailableCount: 0 } });
      }
      const defaultProvider = allActiveProviders.find((p: any) => p.isDefault) || allActiveProviders[0];
      providerId = defaultProvider.id;
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
      // Pick the default or first active provider
      const allActiveProviders = await db.select().from(providers).where(eq(providers.isActive, true));
      if (allActiveProviders.length === 0) {
        throw new NotFoundError("Không có bác sĩ nào đang hoạt động");
      }
      const defaultProvider = allActiveProviders.find((p: any) => p.isDefault) || allActiveProviders[0];
      providerId = defaultProvider.id;
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
publicRouter.post("/appointments/hold", bookingHoldLimiter, async (req, res, next) => {
  try {
    const data = HoldSlotSchema.parse(req.body);
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    const expiresAt = addMinutes(new Date(), 5); // Hold 10 mins
    
    
    
    

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
      let patientRecords = await tx.select().from(patients).where(eq(patients.phone, data.phone.replace(/\D/g, '').replace(/\D/g, ''))).limit(1);
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
          phone: data.phone.replace(/\D/g, ''),
          dob: data.dob,
          gender: data.gender,
          telegramId: data.telegramId || undefined,
          notes: patientNotes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

      const aptStartAt = hold.startAt instanceof Date ? hold.startAt : new Date(hold.startAt);
      const aptEndAt = hold.endAt instanceof Date ? hold.endAt : new Date(hold.endAt);

      // 4. Create the Appointment
      const newAppointment = await tx.insert(appointments).values({
        patientId,
        providerId: hold.providerId,
        serviceId: hold.serviceId,
        startAt: aptStartAt,
        endAt: aptEndAt,
        status: finalStatus,
        notes: data.notes,
        source: "ONLINE"
      }).returning();

      // 5. Delete the hold session so it can't be reused
      await tx.delete(appointmentHolds).where(eq(appointmentHolds.id, hold.id));

      return newAppointment[0];
    }, { isolationLevel: "serializable" });

    // Save contact info mapping (email & telegramId)
    await savePatientContact(bookingResult.patientId, data.phone.replace(/\D/g, ''), {
      email: data.email,
      telegramId: data.telegramId,
    });

    // Send Telegram alert to clinic admin
    sendNewAppointmentAlert(bookingResult.id).catch(console.error);

    // Send automated notification to patient (Telegram and/or Email)
    const notificationEvent = bookingResult.status === "CONFIRMED" ? "CONFIRMED" : "CREATED";
    notifyPatientAppointment(bookingResult.id, notificationEvent).catch(console.error);

    // Emit real-time BOOKING_CREATED event for the Admin Dashboard
    try {
      const { realtimeNotification } = await import("../../services/realtimeNotification.js");
      const { generateVietnameseAnnouncement } = await import("../../services/tts/announcement.js");
      const { generateAudio } = await import("../../services/tts/index.js");

      const fullApt = await db
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
        .where(eq(appointments.id, bookingResult.id))
        .limit(1);

      if (fullApt.length > 0) {
        const payload = fullApt[0] as any;
        try {
          const text = generateVietnameseAnnouncement(payload);
          const audioUrl = await generateAudio(text);
          if (audioUrl) {
            payload.audioUrl = audioUrl;
          }
        } catch (ttsErr) {
          console.error("Failed to generate TTS audio:", ttsErr);
        }
        
        realtimeNotification.emitBookingCreated(payload);
      }
    } catch (e) {
      console.error("Failed to emit real-time event:", e);
    }

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

// Tra cứu thông tin bệnh nhân theo số điện thoại (Quick-Recall xác thực chính xác)
publicRouter.get("/patients/lookup", async (req, res, next) => {
  try {
    return res.json({
      success: true,
      exists: false,
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint kiểm tra số điện thoại có tồn tại hay không (KHÔNG lộ thông tin cá nhân)
publicRouter.get("/patients/check", patientVerifyLimiter, async (req, res, next) => {
  try {
    const rawPhone = String(req.query.phone || "").trim();
    if (!rawPhone) return res.json({ success: true, exists: false });
    const cleaned = rawPhone.replace(/\D/g, "");
    if (cleaned.length < 9) return res.json({ success: true, exists: false });
    const variants = new Set<string>();
    variants.add(cleaned);
    if (cleaned.startsWith("84")) {
      variants.add("0" + cleaned.slice(2)); variants.add(cleaned.slice(2));
    } else if (cleaned.startsWith("0")) {
      variants.add("84" + cleaned.slice(1)); variants.add(cleaned.slice(1));
    } else {
      variants.add("0" + cleaned); variants.add("84" + cleaned);
    }
    const allPatients = await db.select().from(patients);
    const matched = allPatients.find((p: any) => {
      if (!p.phone) return false;
      return variants.has(String(p.phone).replace(/\D/g, ""));
    });
    return res.json({ success: true, exists: !!matched });
  } catch (error) { next(error); }
});

// Endpoint xác thực khách hàng cũ bằng SĐT + Họ tên (Fuzzy Match)
publicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {
  try {
    const { phone, fullName } = req.body;
    if (!phone || !fullName) return res.json({ success: false, match: false });

    const rawPhone = String(phone).trim();
    const cleaned = rawPhone.replace(/\D/g, "");
    const variants = new Set<string>();
    variants.add(cleaned);
    if (cleaned.startsWith("84")) {
      variants.add("0" + cleaned.slice(2)); variants.add(cleaned.slice(2));
    } else if (cleaned.startsWith("0")) {
      variants.add("84" + cleaned.slice(1)); variants.add(cleaned.slice(1));
    } else {
      variants.add("0" + cleaned); variants.add("84" + cleaned);
    }

    const pts = await db.select().from(patients);
    let matchedPatient = null;

    for (const p of pts) {
      if (!p.phone) continue;
      if (variants.has(String(p.phone).replace(/\D/g, ""))) {
        const pName = normalizeName(p.fullName);
        const searchName = normalizeName(fullName);
        if (pName && searchName && (pName === searchName)) { // STRICT MATCH
          matchedPatient = p;
          break;
        }
      }
    }

    if (!matchedPatient) {
      return res.json({ success: true, match: false });
    }

    let notesText = "";
    if (matchedPatient.notes) {
      try {
        const parsed = JSON.parse(matchedPatient.notes);
        notesText = parsed.text || "";
      } catch { notesText = matchedPatient.notes; }
    }
    let email = matchedPatient.email || "";
    if (!email && notesText) {
      const emailMatch = notesText.match(/Email:\s*([^\s|]+)/i);
      if (emailMatch) email = emailMatch[1].trim();
    }
    if (notesText) {
      notesText = notesText.replace(/\|\s*Email:\s*[^\s|]+/gi, "").replace(/Email:\s*[^\s|]+/gi, "").trim();
    }

    // Tìm lịch sử khám gần nhất để gợi ý dịch vụ
    const aptHistory = await db.select().from(appointments).where(eq(appointments.patientId, matchedPatient.id)).orderBy(desc(appointments.startAt));
    let lastServiceId = null;
    let lastServiceName = null;
    if (aptHistory.length > 0 && aptHistory[0].serviceId) {
      lastServiceId = aptHistory[0].serviceId;
      const s = await db.select().from(services).where(eq(services.id, lastServiceId)).limit(1);
      if (s.length > 0) lastServiceName = s[0].name;
    }

    return res.json({
      success: true,
      match: true,
      data: {
        id: matchedPatient.id,
        fullName: matchedPatient.fullName,
        phone: matchedPatient.phone,
        email: email,
        notes: notesText,
        lastServiceId,
        lastServiceName
      }
    });

  } catch (error) { next(error); }
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
publicRouter.get(["/clinic-info", "/clinic-info/:slug"], async (req, res, next) => {
  try {
    const slug = req.params.slug;
    let targetTenantId: string | undefined = undefined;

    const { settings, users } = await import("../../db/schema.js");
    

    if (slug) {
      await appContext.run({ isFullAdmin: true }, async () => {
        const matchedUsers = await db.select().from(users).where(eq(users.slug, slug)).limit(1);
        if (matchedUsers.length > 0) {
          targetTenantId = matchedUsers[0].tenantId;
        }
      });
    }

    await appContext.run({ tenantId: targetTenantId }, async () => {
      let settingRes = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
      if (settingRes.length === 0) {
        settingRes = await db.select().from(settings).where(eq(settings.id, "clinic_profile")).limit(1);
      }
      if (settingRes.length === 0) {
        settingRes = await db.select().from(settings).where(eq(settings.key, "clinic_profile")).limit(1);
      }
      if (settingRes.length === 0) {
        settingRes = await db.select().from(settings).where(eq(settings.key, "clinicProfile")).limit(1);
      }
      let clinicProfile = settingRes.length > 0 ? settingRes[0].value : null;
      if (typeof clinicProfile === "string") {
        try {
          clinicProfile = JSON.parse(clinicProfile);
        } catch (e) {}
      }
      if (clinicProfile && !clinicProfile.clinicName && clinicProfile.name) {
        clinicProfile.clinicName = clinicProfile.name;
      }

      let formConfigRes = await db.select().from(settings).where(eq(settings.id, "bookingFormConfig")).limit(1);
      if (formConfigRes.length === 0) {
        formConfigRes = await db.select().from(settings).where(eq(settings.key, "bookingFormConfig")).limit(1);
      }
      let bookingFormConfig = formConfigRes.length > 0 ? formConfigRes[0].value : null;
      if (typeof bookingFormConfig === "string") {
        try {
          bookingFormConfig = JSON.parse(bookingFormConfig);
        } catch (e) {}
      }

      const botUsername = await getTelegramBotUsername();

      let bannerRes = await db.select().from(settings).where(eq(settings.id, "announcementBanner")).limit(1);
      if (bannerRes.length === 0) {
        bannerRes = await db.select().from(settings).where(eq(settings.key, "announcementBanner")).limit(1);
      }
      let announcementBanner = null;
      if (bannerRes.length > 0) {
        announcementBanner = typeof bannerRes[0].value === 'string' ? JSON.parse(bannerRes[0].value) : bannerRes[0].value;
      }

      // We also inject tenantId so the frontend knows who it is interacting with
      res.json({
        success: true,
        data: {
          clinicProfile,
          bookingFormConfig,
          telegramBotUsername: botUsername,
          announcementBanner,
          tenantId: targetTenantId || null
        }
      });
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
        serviceId: appointments.serviceId,
        serviceName: services.name,
        providerName: providers.name
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
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

function normalizeName(str: string) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

publicRouter.post("/appointments/lookup", appointmentLookupLimiter, async (req, res, next) => {
  try {
    const { phone, code, fullName, pin } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: { message: "Vui lòng cung cấp số điện thoại" } });
    }
    if (!code && !fullName) {
      return res.status(400).json({ success: false, error: { message: "Vui lòng cung cấp Mã lịch hẹn hoặc Họ tên để xác thực" } });
    }
    
    // Tìm patient dựa trên phone
    const pts = await db.select().from(patients).where(eq(patients.phone, phone.replace(/\D/g, '')));
    if (pts.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const patientIds = pts.map(p => p.id);
    
    // Tìm các cuộc hẹn của patient này
    let query = db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      serviceId: appointments.serviceId,
      serviceName: services.name,
      providerName: providers.name,
      cancelReason: appointments.cancelReason
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(providers, eq(appointments.providerId, providers.id))
    .where(inArray(appointments.patientId, patientIds));
    
    const results = await query;
    let finalResults = results;
    let patientDob = null;
    
    // Lọc theo code hoặc fullName
    if (code) {
      finalResults = results.filter(r => r.id.includes(code) || r.id === code);
    } else if (fullName) {
      const inputNameNorm = normalizeName(fullName);
      const matchedPatient = pts.find(p => normalizeName(p.fullName) === inputNameNorm);
      
      if (!matchedPatient) {
        return res.status(403).json({ success: false, error: { message: "Họ tên không khớp với số điện thoại đã đăng ký. Vui lòng kiểm tra lại để bảo mật thông tin." } });
      }
      
      patientDob = matchedPatient.dob;
      finalResults = results.filter(r => r.patientId === matchedPatient.id);
    }
    
    if (code) {
      // If looked up by exact code, just return it
      return res.json({ success: true, data: finalResults.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()) });
    }
    
    const now = new Date();
    let upcoming = [];
    let past = [];
    
    for (const r of finalResults) {
      if (new Date(r.startAt).getTime() < now.getTime() - 24 * 60 * 60 * 1000) { // older than yesterday
        past.push(r);
      } else {
        upcoming.push(r);
      }
    }
    
    if (past.length > 0) {
      if (pin) {
        let isPinValid = false;
        const pinClean = String(pin).trim();
        
        if (patientDob && patientDob.includes(pinClean)) {
          isPinValid = true;
        } else {
          if (finalResults.some(r => r.id.slice(-4) === pinClean)) {
             isPinValid = true;
          }
        }
        
        if (!isPinValid) {
           return res.status(403).json({ success: false, error: { message: "Mã PIN không đúng. Vui lòng nhập Năm sinh (VD: 1990) hoặc 4 số cuối mã lịch hẹn." } });
        }
      } else {
        return res.json({ 
          success: true, 
          data: upcoming.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
          hasHistory: true 
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: finalResults.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
      hasHistory: false
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.patch("/appointments/:id/cancel", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: { message: "Cần xác thực bằng số điện thoại để hủy lịch" } });
    }
    
    const apts = await db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      status: appointments.status,
      providerId: appointments.providerId,
      startAt: appointments.startAt
    }).from(appointments).where(eq(appointments.id, id)).limit(1);
    
    if (apts.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }
    
    const pt = await db.select().from(patients).where(eq(patients.id, apts[0].patientId)).limit(1);
    if (pt.length === 0 || pt[0].phone !== phone) {
      return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với hồ sơ đặt lịch" } });
    }
    
    if (apts[0].status !== 'REQUESTED' && apts[0].status !== 'PENDING' && apts[0].status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, error: { message: "Không thể hủy lịch ở trạng thái hiện tại" } });
    }
    
    await db.update(appointments).set({ status: 'CANCEL_PATIENT' }).where(eq(appointments.id, id));
    
    import('../../services/realtimeNotification.js').then(({ realtimeNotification }) => {
      realtimeNotification.emitBookingCreated({ id, action: 'cancel' });
    });
    
    res.json({ success: true, message: "Hủy lịch thành công" });
  } catch (error) {
    next(error);
  }
});

publicRouter.patch("/appointments/:id/reschedule", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone, newDate, newTime, newEndAt } = req.body;
    
    if (!phone || !newDate || !newTime) {
      return res.status(400).json({ success: false, error: { message: "Cần xác thực bằng số điện thoại và cung cấp ngày giờ mới" } });
    }
    
    const apts = await db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      status: appointments.status,
      providerId: appointments.providerId,
      startAt: appointments.startAt
    }).from(appointments).where(eq(appointments.id, id)).limit(1);
    
    if (apts.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }
    
    const pt = await db.select().from(patients).where(eq(patients.id, apts[0].patientId)).limit(1);
    if (pt.length === 0 || pt[0].phone !== phone) {
      return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với hồ sơ đặt lịch" } });
    }
    
    if (apts[0].status !== 'REQUESTED' && apts[0].status !== 'PENDING' && apts[0].status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, error: { message: "Không thể dời lịch ở trạng thái hiện tại" } });
    }
    
    const startAt = new Date(`${newDate}T${newTime}:00`);
    const endAt = newEndAt ? new Date(newEndAt) : new Date(startAt.getTime() + 30 * 60000);
    
    // Check overlap
    const occupiedSlots = await getProviderOccupiedSlots(apts[0].providerId || (await db.select().from(providers).limit(1))[0].id, startAt);
    // Remove the current appointment from occupied to avoid self-conflict
    const filteredOccupied = occupiedSlots.filter(o => o.type !== 'APPOINTMENT' || Math.abs(o.startAt.getTime() - new Date(apts[0].startAt).getTime()) > 1000);
    if (isSlotConflict(startAt, endAt, filteredOccupied)) {
       return res.status(400).json({ success: false, error: { message: "Khung giờ này đã có người đặt, vui lòng chọn giờ khác." } });
    }
    
    await db.update(appointments).set({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), status: 'REQUESTED' }).where(eq(appointments.id, id));
    
    import('../../services/realtimeNotification.js').then(({ realtimeNotification }) => {
      realtimeNotification.emitBookingCreated({ id, action: 'reschedule' });
    });
    
    res.json({ success: true, message: "Dời lịch thành công, đang chờ phòng khám xác nhận lại" });
  } catch (error) {
    next(error);
  }
});

// [M-Shorten] Rút gọn link an toàn đa tầng: Link phòng khám chính chủ, TinyURL, da.gd (100% không quảng cáo)
publicRouter.post("/shorten", async (req, res, next) => {
  try {
    const { url, slug, origin: clientOrigin } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: { message: "URL là bắt buộc" } });
    }

    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const origin = clientOrigin || req.get('origin') || `${protocol}://${host}`;

    const { shortenUrl } = await import('../../services/urlShortener.js');
    const result = await shortenUrl(url, slug, origin);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});


// Endpoint giữ chỗ đặt lịch tạm thời
publicRouter.post("/slots/hold", async (req, res, next) => {
  try {
    const { serviceId, date, time } = req.body;
    if (!serviceId || !date || !time) return res.status(400).json({ success: false });

    // Check if slot is already held by someone else
    const now = new Date();
    const existingHold = await db.select().from(appointmentHolds)
      .where(
        eq(appointmentHolds.date, date) && 
        eq(appointmentHolds.time, time)
      ).limit(1);

    if (existingHold.length > 0) {
      const hold = existingHold[0];
      if (new Date(hold.expiresAt) > now) {
        return res.status(409).json({ success: false, error: 'Khung giờ này vừa có người khác chọn. Vui lòng chọn giờ khác.' });
      }
      // If expired, we can overwrite it
      await db.update(appointmentHolds)
        .set({ expiresAt: new Date(now.getTime() + 5 * 60000) })
        .where(eq(appointmentHolds.id, hold.id));
    } else {
      await db.insert(appointmentHolds).values({
        serviceId,
        date,
        time,
        expiresAt: new Date(now.getTime() + 5 * 60000),
        createdAt: now
      });
    }

    return res.json({ success: true, expiresAt: now.getTime() + 5 * 60000 });
  } catch (error) { next(error); }
});

export default publicRouter;
