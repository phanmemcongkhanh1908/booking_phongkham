import { Router } from "express";
import { z } from "zod";
import { calculateAvailableSlots } from "../../core/scheduling.js";
import { parseISO, addMinutes, addDays, format, startOfToday } from "date-fns";
import crypto from "crypto";
import { db } from "../../db/index.js";
import { appointmentHolds, appointments, patients, services, providers, settings } from "../../db/schema.js";
import { HoldSlotSchema, BookAppointmentSchema } from "../../../shared/schemas.js";
import { eq, and, gte, lt, gt, sql, inArray, desc } from "drizzle-orm";
import { ConflictError, BadRequestError, NotFoundError, ForbiddenError } from "../../core/errors.js";
import { sendNewAppointmentAlert, getTelegramBotUsername } from "../../core/telegram.js";
import { getProviderOccupiedSlots, isSlotConflict } from "../../core/scheduling.js";
import { notifyPatientAppointment } from "../../services/patientNotification.js";
import { sendAppointmentStatusPush } from "../../services/notification.js";
import { savePatientContact } from "../../services/patientContact.js";
import { createRateLimiter } from "../../core/rateLimit.js";

const buildTenantRateKey = (req: any) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket?.remoteAddress) || "unknown";
  const tenantPart =
    req.headers["x-tenant-id"] ||
    req.query?.tenantId ||
    req.body?.tenantId ||
    req.query?.clinic ||
    req.query?.slug ||
    req.body?.clinicSlug ||
    "default";
  return `${ip}:${String(tenantPart).trim().toLowerCase()}:${req.baseUrl || ""}${req.path || ""}`;
};

// Rate limiters for public endpoints (isolated per IP + clinic tenant so clinics never cross-throttle)
const bookingHoldLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 250,
  keyGenerator: buildTenantRateKey,
  message: "Bạn đã gửi quá nhiều yêu cầu đặt giữ chỗ. Vui lòng đợi 1 phút trước khi thử lại."
});

const patientVerifyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: buildTenantRateKey,
  message: "Quá nhiều yêu cầu kiểm tra hoặc xác thực thông tin. Vui lòng đợi 1 phút."
});

const appointmentLookupLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 150,
  keyGenerator: buildTenantRateKey,
  message: "Quá nhiều yêu cầu tra cứu lịch hẹn. Vui lòng thử lại sau 1 phút."
});

import { appContext } from "../../core/context.js";
const publicRouter = Router();
publicRouter.use(async (req, res, next) => {
  try {
    let tenantId = (req.headers["x-tenant-id"] || req.query.tenantId || (req.body as any)?.tenantId || null) as string | null;
    if (!tenantId) {
      const slugHint = (
        req.query.clinic ||
        req.query.slug ||
        (req.body as any)?.clinicSlug ||
        ""
      )
        .toString()
        .trim();
      if (slugHint) {
        const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
        const matched = await findClinicBySlug(slugHint);
        if (matched?.tenantId) {
          tenantId = matched.tenantId;
        }
      }
    }
    appContext.run({ tenantId: tenantId ? String(tenantId).trim() : null }, () => {
      next();
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/services", async (req, res, next) => {
  try {
    const ctxTenant = appContext.getStore()?.tenantId || null;
    const allServices = await db.select().from(services);
    // Filter active services in memory to gracefully handle older records where isActive might be missing
    const activeServices = allServices.filter((s: any) => s.isActive !== false);
    const { enrichServicesWithReviewStats } = await import("../../services/reviewAggregation.js");
    const enriched = await enrichServicesWithReviewStats(activeServices, ctxTenant, {
      includeHidden: false,
    });
    res.json({ success: true, data: enriched });
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
  providerId: z.string().optional(),
  serviceId: z.string().min(1, "Thiếu ID Dịch vụ"),
  serviceIds: z.union([z.string(), z.array(z.string())]).optional(),
  durationMins: z.coerce.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD"),
});

const AvailabilitySummaryQuerySchema = z.object({
  providerId: z.string().optional(),
  serviceId: z.string().min(1, "Thiếu ID Dịch vụ"),
  serviceIds: z.union([z.string(), z.array(z.string())]).optional(),
  durationMins: z.coerce.number().optional(),
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

    const targetServiceIds = Array.isArray(query.serviceIds)
      ? query.serviceIds
      : typeof query.serviceIds === "string"
        ? query.serviceIds.split(",")
        : (query.serviceId || "").includes(",")
          ? query.serviceId.split(",")
          : [query.serviceId];

    const dayPromises = Array.from({ length: daysCount }).map(async (_, idx) => {
      const targetDate = addDays(start, idx);
      const dateStr = format(targetDate, "yyyy-MM-dd");
      const availableSlots = await calculateAvailableSlots(
        providerId!,
        query.serviceId,
        targetDate,
        { 
          includeUnavailable: false,
          customDurationMins: query.durationMins,
          serviceIds: targetServiceIds
        }
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

    const targetServiceIds = Array.isArray(query.serviceIds)
      ? query.serviceIds
      : typeof query.serviceIds === "string"
        ? query.serviceIds.split(",")
        : (query.serviceId || "").includes(",")
          ? query.serviceId.split(",")
          : [query.serviceId];

    const availableSlots = await calculateAvailableSlots(
      providerId,
      query.serviceId,
      targetDate,
      { 
        includeUnavailable,
        customDurationMins: query.durationMins,
        serviceIds: targetServiceIds
      }
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
    const expiresAt = addMinutes(new Date(), 10); // Hold 10 mins (generous for patient form filling)
    
    // Resolve tenantId
    let targetTenantId = (data.tenantId || req.headers["x-tenant-id"]) as string | undefined;
    const rawClinicSlug = (data.clinicSlug || req.query.clinic || req.query.slug || "") as string;
    if (!targetTenantId && rawClinicSlug) {
      const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
      const matched = await findClinicBySlug(rawClinicSlug.trim());
      if (matched?.tenantId) {
        targetTenantId = matched.tenantId;
      }
    }

    // SERIALIZABLE Transaction scoped strictly to targetTenantId to prevent cross-tenant or same-slot conflicts
    const holdResult = await appContext.run({ tenantId: targetTenantId || null }, async () => {
      return await db.transaction(async (tx: any) => {
        // Check if slot is still available within this clinic tenant
        const bookingConds: any[] = [
          eq(appointments.providerId, data.providerId),
          lt(appointments.startAt, endAt),
          gt(appointments.endAt, startAt),
          sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC')`,
        ];
        if (targetTenantId) bookingConds.push(eq(appointments.tenantId, targetTenantId));
        const conflictingBookings = await tx.select().from(appointments).where(and(...bookingConds));

        const holdConds: any[] = [
          eq(appointmentHolds.providerId, data.providerId),
          gte(appointmentHolds.expiresAt, new Date()),
          lt(appointmentHolds.startAt, endAt),
          gt(appointmentHolds.endAt, startAt),
        ];
        if (targetTenantId) holdConds.push(eq(appointmentHolds.tenantId, targetTenantId));
        const conflictingHolds = await tx.select().from(appointmentHolds).where(and(...holdConds));

        if (conflictingBookings.length > 0 || conflictingHolds.length > 0) {
          throw new ConflictError("Rất tiếc, giờ này vừa được đặt bởi người khác. Vui lòng chọn giờ khác.");
        }

        const sessionToken = crypto.randomUUID();

        const newHold = await tx.insert(appointmentHolds).values({
          sessionToken,
          providerId: data.providerId,
          serviceId: data.serviceId,
          serviceIds: data.serviceIds || [data.serviceId],
          customServiceName: data.customServiceName,
          startAt,
          endAt,
          expiresAt,
          tenantId: targetTenantId || undefined,
        }).returning();

        return newHold[0];
      }, { isolationLevel: "serializable" });
    });

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
publicRouter.post("/appointments", bookingHoldLimiter, async (req, res, next) => {
  try {
    const data = BookAppointmentSchema.parse(req.body);

    let targetTenantId = (data.tenantId || req.headers["x-tenant-id"]) as string | undefined;
    const rawClinicSlug = (data.clinicSlug || req.query.clinic || req.query.slug || "") as string;
    if (!targetTenantId && rawClinicSlug) {
      const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
      const matched = await findClinicBySlug(rawClinicSlug.trim());
      if (matched?.tenantId) {
        targetTenantId = matched.tenantId;
      }
    }

    const bookingResult = await appContext.run({ tenantId: targetTenantId || null }, async () => {
      return await db.transaction(async (tx: any) => {
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

      if (!targetTenantId && (hold as any).tenantId) {
        targetTenantId = (hold as any).tenantId;
      }

      // 2. Find or Create Patient (isolated by tenant)
      const cleanPhone = data.phone.replace(/\D/g, '');
      const allPhonePatients = await tx.select().from(patients).where(eq(patients.phone, cleanPhone));
      const patientRecords = targetTenantId 
        ? allPhonePatients.filter((p: any) => p.tenantId === targetTenantId)
        : allPhonePatients;

      const incomingName = (data.fullName || '').trim();
      const normalizedIncomingName = incomingName.toLowerCase().replace(/\s+/g, ' ');
      const isProxyBooking = data.bookingFor === 'relative';
      const shouldCreateNewProfile = isProxyBooking || data.isNewProfile === true;

      // Look for an existing patient with exact matching name under this phone number
      let matchingPatient = null;
      if (!shouldCreateNewProfile) {
        for (const p of patientRecords) {
          if (p.fullName && p.fullName.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedIncomingName) {
            matchingPatient = p;
            break;
          }
        }
      }

      const cleanUserNote = stripSystemBookingTags(data.notes);
      let patientId;
      let patientNotes = cleanUserNote || undefined;
      if (data.email) {
        patientNotes = patientNotes ? (patientNotes + ' | Email: ' + data.email) : ('Email: ' + data.email);
      }

      if (matchingPatient) {
        // EXACT MATCH found: Existing patient booking another appointment.
        // DO NOT change their fullName! Keep existing patient profile intact.
        patientId = matchingPatient.id;
        
        let mergedNotes = patientNotes;
        if (matchingPatient.notes) {
          try {
            const parsed = JSON.parse(matchingPatient.notes);
            const existingCleanText = stripSystemBookingTags(parsed.text || '');
            parsed.text = existingCleanText;
            if (mergedNotes) {
              parsed.text = parsed.text ? (parsed.text + '\n' + mergedNotes) : mergedNotes;
            }
            mergedNotes = JSON.stringify(parsed);
          } catch (e) {
            const existingClean = stripSystemBookingTags(matchingPatient.notes);
            mergedNotes = existingClean ? (mergedNotes ? existingClean + '\n' + mergedNotes : existingClean) : mergedNotes;
          }
        } else if (mergedNotes) {
          mergedNotes = JSON.stringify({
            text: mergedNotes,
            diagnosis: '',
            treatmentPlan: '',
            documents: [],
            bookingFor: 'self',
            isProxyBooking: false,
            primaryContactPhone: cleanPhone
          });
        }

        await tx.update(patients).set({
          dob: data.dob || matchingPatient.dob,
          gender: data.gender || matchingPatient.gender,
          telegramId: data.telegramId || matchingPatient.telegramId,
          notes: mergedNotes || matchingPatient.notes,
          tenantId: targetTenantId || matchingPatient.tenantId,
          updatedAt: new Date(),
        }).where(eq(patients.id, patientId));
      } else {
        // NO MATCH OR USER EXPLICITLY REQUESTED NEW PROFILE / BOOKING FOR RELATIVE:
        // CRITICAL: NEVER overwrite or rename any existing patient!
        // We MUST create a new patient row so historical records remain completely untouched!
        // IMPORTANT: Only mark as proxy booking ('Đặt lịch hộ') when bookingFor === 'relative'.
        const newPatientNotesJson = JSON.stringify({ 
          text: patientNotes || '', 
          diagnosis: '', 
          treatmentPlan: '', 
          documents: [],
          bookingFor: isProxyBooking ? 'relative' : 'self',
          isProxyBooking,
          primaryContactPhone: cleanPhone
        });

        const newPatient = await tx.insert(patients).values({
          fullName: incomingName,
          phone: cleanPhone,
          dob: data.dob,
          gender: data.gender,
          telegramId: data.telegramId || undefined,
          notes: newPatientNotesJson,
          bookingFor: isProxyBooking ? 'relative' : 'self',
          isProxyBooking,
          primaryContactPhone: cleanPhone,
          tenantId: targetTenantId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any).returning();
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

      // 4. Check for overlap again just to be safe (prevent race condition bypass)
      const conflictConds: any[] = [
        eq(appointments.providerId, hold.providerId),
        lt(appointments.startAt, aptEndAt),
        gt(appointments.endAt, aptStartAt),
        sql`${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC')`,
      ];
      if (targetTenantId) conflictConds.push(eq(appointments.tenantId, targetTenantId));
      const conflictingBookings = await tx.select().from(appointments).where(and(...conflictConds));

      if (conflictingBookings.length > 0) {
        throw new ConflictError("Khung giờ này đã có người khác đặt trong tích tắc. Vui lòng thử lại với giờ khác.");
      }

      // 5. Create the Appointment with tenantId
      const serviceIdsToStore = data.serviceIds || (hold as any).serviceIds || [hold.serviceId];
      const customServiceNameToStore = data.customServiceName || (hold as any).customServiceName;

      const newAppointment = await tx.insert(appointments).values({
        patientId,
        providerId: hold.providerId,
        serviceId: hold.serviceId,
        serviceIds: serviceIdsToStore,
        customServiceName: customServiceNameToStore,
        startAt: aptStartAt,
        endAt: aptEndAt,
        status: finalStatus,
        notes: cleanUserNote || undefined,
        bookingFor: isProxyBooking ? 'relative' : 'self',
        isProxyBooking,
        bookedForName: incomingName,
        source: "ONLINE",
        tenantId: targetTenantId || undefined,
      } as any).returning();

      // 6. Delete the hold session so it can't be reused
      await tx.delete(appointmentHolds).where(eq(appointmentHolds.id, hold.id));

      return newAppointment[0];
    }, { isolationLevel: "serializable" });
    });

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

    // Send Web Push (VAPID) exclusively to this clinic's subscribed Admin mobile/desktop devices
    import("../../services/notification.js")
      .then(({ sendAdminNewBookingPush }) => sendAdminNewBookingPush(bookingResult.id))
      .catch(console.error);

    // Sync appointment to Firestore so 1-hour reminder queries see it immediately
    import("../../services/appointmentFirestoreService.js")
      .then(({ syncAppointmentToFirestore }) => syncAppointmentToFirestore(bookingResult.id))
      .catch(() => {});

    // Fast local DB lookup for response metadata + background async TTS & SSE dispatch
    let aptDetailPayload: any = null;
    const targetTenantSnapshot = bookingResult.tenantId || (req.body as any).tenantId || targetTenantId || null;
    try {
      const { realtimeNotification } = await import("../../services/realtimeNotification.js");
      const { generateVietnameseAnnouncement } = await import("../../services/tts/announcement.js");
      const { generateAudio } = await import("../../services/tts/index.js");

      const fullApt = await appContext.run({ tenantId: targetTenantSnapshot }, async () => {
        return await db
          .select({
            id: appointments.id,
            tenantId: appointments.tenantId,
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
      });

      if (fullApt.length > 0) {
        const payload = fullApt[0] as any;
        if (!payload.tenantId && targetTenantSnapshot) {
          payload.tenantId = targetTenantSnapshot;
        }
        if (bookingResult.customServiceName) {
          payload.serviceName = bookingResult.customServiceName;
        }
        aptDetailPayload = payload;

        void (async () => {
          try {
            if (realtimeNotification.hasClientsForTenant(payload.tenantId)) {
              const text = generateVietnameseAnnouncement(payload);
              const audioUrl = await Promise.race([
                generateAudio(text),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
              ]);
              if (audioUrl) {
                payload.audioUrl = audioUrl;
              }
            }
            realtimeNotification.emitBookingCreated(payload);
          } catch (bgErr) {
            console.error("Failed to dispatch realtime notification:", bgErr);
          }
        })();
      }
    } catch (e) {
      console.error("Failed to prepare real-time event:", e);
    }

    const botUsername = await getTelegramBotUsername();

    res.json({
      success: true,
      data: {
        appointmentId: bookingResult.id,
        tenantId: targetTenantSnapshot || null,
        status: bookingResult.status,
        startAt: bookingResult.startAt,
        endAt: bookingResult.endAt,
        serviceId: bookingResult.serviceId || null,
        serviceIds: Array.isArray((bookingResult as any).serviceIds)
          ? (bookingResult as any).serviceIds
          : [bookingResult.serviceId].filter(Boolean),
        serviceName: aptDetailPayload?.serviceName || bookingResult.customServiceName || null,
        providerName: aptDetailPayload?.providerName || null,
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



import { adminAuth } from "../../lib/firebase-admin.js";

publicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {
  try {
    const { phone, fullName, firebaseToken } = req.body;
    if (!phone) return res.json({ success: false, match: false });

    let isOtpVerified = false;

    // Check Firebase Token if provided
    if (firebaseToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        
        // --- START QUOTA TRACKER ---
        try {
          const { system_metrics } = await import('../../db/schema.js');
          const date = new Date();
          const monthKey = `otp_sent_${date.getFullYear()}_${date.getMonth() + 1}`;
          const metrics = await db.select().from(system_metrics).where(eq(system_metrics.id, monthKey)).limit(1);
          if (metrics.length > 0) {
            await db.update(system_metrics).set({ value: (Number(metrics[0].value) || 0) + 1 }).where(eq(system_metrics.id, monthKey));
          } else {
            await db.insert(system_metrics).values({ id: monthKey, value: 1, updatedAt: new Date().toISOString() });
          }
        } catch(e) {
          console.error("Lỗi đếm quota OTP", e);
        }
        // --- END QUOTA TRACKER ---
        
        // Ensure the phone number matches
        const tokenPhone = decodedToken.phone_number; // Format: +84...
        const rawPhone = String(phone).trim().replace(/\D/g, "");
        const rawTokenPhone = (tokenPhone || "").replace(/\D/g, "");
        
        // Match the last 9 digits (since 84912345678 and 0912345678 both end in 912345678)
        if (rawTokenPhone.length >= 9 && rawPhone.length >= 9 && rawTokenPhone.slice(-9) === rawPhone.slice(-9)) {
          isOtpVerified = true;
        } else {
          return res.json({ success: false, error: "Số điện thoại xác thực không khớp" });
        }
      } catch (err) {
         console.error("Firebase Auth Error", err);
         return res.json({ success: false, error: "Mã xác thực Firebase không hợp lệ hoặc đã hết hạn" });
      }
    } else if (!fullName) {
       return res.json({ success: false, match: false });
    }

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
    const phonePatients = pts.filter((p: any) => p.phone && variants.has(String(p.phone).replace(/\D/g, "")));
    let matchedPatient: any = null;

    if (isOtpVerified) {
      matchedPatient =
        phonePatients.find((p: any) => !isPatientProxyRecord(p)) ||
        phonePatients[0] ||
        null;
    } else {
      const searchName = normalizeName(fullName || "");
      for (const p of phonePatients) {
        const pName = normalizeName(p.fullName);
        if (pName && searchName && pName === searchName) {
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
      notesText = stripSystemBookingTags(
        notesText.replace(/\|\s*Email:\s*[^\s|]+/gi, "").replace(/Email:\s*[^\s|]+/gi, "")
      );
    }

    // Tìm lịch sử khám gần nhất để gợi ý dịch vụ + trả về danh sách lịch sử đặt lịch cho popup modal
    const aptHistory = await db.select().from(appointments).where(eq(appointments.patientId, matchedPatient.id)).orderBy(desc(appointments.startAt));
    let lastServiceId = null;
    let lastServiceName = null;
    if (aptHistory.length > 0 && aptHistory[0].serviceId) {
      lastServiceId = aptHistory[0].serviceId;
      const s = await db.select().from(services).where(eq(services.id, lastServiceId)).limit(1);
      if (s.length > 0) lastServiceName = s[0].name;
    }

    // Nếu người xác thực là hồ sơ chính (hoặc qua OTP), cho phép xem kèm các lịch đặt hộ cùng SĐT (cùng tenant nếu có)
    const matchedIsProxy = isPatientProxyRecord(matchedPatient);
    const scopePatients = (!matchedIsProxy || isOtpVerified)
      ? phonePatients.filter((p: any) => {
          if (matchedPatient.tenantId && p.tenantId && p.tenantId !== matchedPatient.tenantId) {
            return false;
          }
          if (p.id === matchedPatient.id) return true;
          return isOtpVerified || isPatientProxyRecord(p);
        })
      : [matchedPatient];

    const scopePatientIds = scopePatients.map((p: any) => p.id);
    const bookingHistory = await buildBookingHistoryList(scopePatientIds, scopePatients);

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
        lastServiceName,
        bookingHistory
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

// Public endpoint lấy gói cấu hình trọn gói phòng khám (Branding, Giờ làm việc, Dịch vụ, Bác sĩ) theo slug hoặc subdomain
const handleClinicBundle = async (req: any, res: any, next: any) => {
  try {
    const { getClinicFullBundle, extractSubdomainFromHost } = await import("../../services/clinicFirestoreService.js");

    let slug = (req.params.slug || (req.query.slug as string) || (req.query.clinic as string) || (req.query.s as string) || "").trim();

    // Nếu không có slug trong URL path hoặc query, kiểm tra subdomain (ví dụ: lephuong.domain.com)
    if (!slug) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const detectedSubdomain = extractSubdomainFromHost(typeof host === "string" ? host : Array.isArray(host) ? host[0] : undefined);
      if (detectedSubdomain) {
        console.log(`[ClinicBundle] Detected clinic slug from subdomain: "${detectedSubdomain}"`);
        slug = detectedSubdomain;
      }
    }

    const bundle = await getClinicFullBundle(slug || undefined);

    res.json({
      success: true,
      data: bundle,
    });
  } catch (error) {
    next(error);
  }
};

publicRouter.get("/clinic-bundle", handleClinicBundle);
publicRouter.get("/clinic-bundle/:slug", handleClinicBundle);
publicRouter.get("/clinic-info", handleClinicBundle);
publicRouter.get("/clinic-info/:slug", handleClinicBundle);

// SSE stream dành riêng cho thiết bị khách hàng đang giữ mã lịch hẹn (chỉ nhận đúng sự kiện hoàn tất của chính appointmentId thiết bị đã đặt)
publicRouter.get("/appointments/stream", async (req, res, next) => {
  try {
    const rawIds = String(req.query.ids || req.query.appointmentId || "").trim();
    const ids = rawIds
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 8)
      .slice(0, 50);

    const { realtimeNotification } = await import("../../services/realtimeNotification.js");
    realtimeNotification.addPatientClient(req, res, ids);
  } catch (error) {
    next(error);
  }
});

// Kiểm tra danh sách lịch hẹn đã hoàn thành nhưng chưa được đánh giá từ chính thiết bị đặt lịch
publicRouter.post("/appointments/pending-reviews", async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.body?.appointmentIds) ? req.body.appointmentIds : [];
    const targetIds = Array.from(
      new Set(
        rawIds
          .map((id: any) => String(id || "").trim())
          .filter((id: string) => id.length >= 8)
      )
    ).slice(0, 50) as string[];

    if (targetIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const rawClinicSlug = typeof req.body?.clinicSlug === "string" ? req.body.clinicSlug.trim().toLowerCase() : "";
    let filterTenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : "";
    let hasExplicitClinicFilter = Boolean(filterTenantId);

    if (!filterTenantId && rawClinicSlug) {
      try {
        const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
        const matched = await findClinicBySlug(rawClinicSlug);
        if (matched) {
          hasExplicitClinicFilter = true;
          filterTenantId = matched.tenantId ? String(matched.tenantId).trim() : "";
        }
      } catch {}
    }

    const [matchedApts, allServices, allProviders, allPatients, allSettings] = await Promise.all([
      db.select().from(appointments).where(inArray(appointments.id, targetIds)),
      db.select().from(services),
      db.select().from(providers),
      db.select().from(patients),
      db.select().from(settings),
    ]);

    const serviceMap = new Map<string, string>();
    for (const s of allServices as any[]) {
      if (s?.id && s?.name) serviceMap.set(s.id, s.name);
      if (s?.originalId && s?.name && !serviceMap.has(s.originalId)) {
        serviceMap.set(s.originalId, s.name);
      }
    }
    const providerMap = new Map((allProviders as any[]).map((p) => [p.id, p]));
    const patientMap = new Map((allPatients as any[]).map((p) => [p.id, p]));

    const pending = matchedApts
      .filter((apt: any) => {
        if (String(apt.status || "").toUpperCase() !== "COMPLETED") return false;
        const hasRating = apt.rating !== null && apt.rating !== undefined && Number(apt.rating) > 0;
        const hasServiceRatings =
          apt.serviceRatings &&
          typeof apt.serviceRatings === "object" &&
          Object.keys(apt.serviceRatings).length > 0;
        if (hasRating || hasServiceRatings || apt.reviewedAt) return false;
        if (hasExplicitClinicFilter) {
          const aptTenantStr = apt.tenantId ? String(apt.tenantId).trim() : "";
          if (aptTenantStr !== filterTenantId) return false;
        }
        return true;
      })
      .map((apt: any) => {
        const aptTenantId = apt.tenantId ? String(apt.tenantId).trim() : null;
        const normalizedIds = Array.from(
          new Set(
            [
              apt.serviceId,
              ...(Array.isArray(apt.serviceIds) ? apt.serviceIds : []),
            ]
              .filter(Boolean)
              .map((s: any) => String(s).trim())
          )
        );
        const serviceItems = normalizedIds.map((sId) => ({
          id: sId,
          name: serviceMap.get(sId) || apt.customServiceName || "Dịch vụ nha khoa",
        }));
        const resolvedServiceName =
          apt.customServiceName ||
          (serviceItems.length > 0 ? serviceItems.map((i) => i.name).join(" + ") : "Dịch vụ nha khoa");

        const profileSetting =
          (aptTenantId
            ? (allSettings as any[]).find((s) => s.id === "clinicProfile" && String(s.tenantId || "").trim() === aptTenantId)
            : null) ||
          (allSettings as any[]).find((s) => s.id === "clinicProfile" && !s.tenantId) ||
          (allSettings as any[]).find((s) => s.id === "clinicProfile");
        const profileVal =
          profileSetting?.value && typeof profileSetting.value === "object" ? (profileSetting.value as any) : {};

        const pt = patientMap.get(apt.patientId);
        const pr = providerMap.get(apt.providerId);

        return {
          id: apt.id,
          status: apt.status,
          tenantId: aptTenantId,
          clinicName: profileVal.clinicName || profileVal.name || "Phòng khám Nha khoa",
          clinicSlug: profileVal.slug ? String(profileVal.slug).trim().toLowerCase() : null,
          startAt: apt.startAt,
          endAt: apt.endAt,
          serviceId: apt.serviceId || normalizedIds[0] || null,
          serviceIds: normalizedIds,
          serviceItems,
          serviceName: resolvedServiceName,
          providerName: pr?.name || profileVal.doctorName || "Bác sĩ chuyên khoa",
          patientName: apt.bookedForName || pt?.fullName || "Quý khách",
          rating: apt.rating ?? null,
          reviewedAt: apt.reviewedAt ?? null,
        };
      })
      .sort((a: any, b: any) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime());

    res.json({ success: true, data: pending });
  } catch (error) {
    next(error);
  }
});

// Kiểm tra trạng thái hiện tại cho danh sách appointmentId mà thiết bị khách hàng đang nắm giữ (phục vụ popup cập nhật & đồng bộ)
publicRouter.post("/appointments/device-statuses", async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.body?.appointmentIds) ? req.body.appointmentIds : [];
    const targetIds = Array.from(
      new Set(
        rawIds
          .map((id: any) => String(id || "").trim())
          .filter((id: string) => id.length >= 8)
      )
    ).slice(0, 50) as string[];

    if (targetIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const rawClinicSlug = typeof req.body?.clinicSlug === "string" ? req.body.clinicSlug.trim().toLowerCase() : "";
    let filterTenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : "";
    let hasExplicitClinicFilter = Boolean(filterTenantId);

    if (!filterTenantId && rawClinicSlug) {
      try {
        const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
        const matched = await findClinicBySlug(rawClinicSlug);
        if (matched) {
          hasExplicitClinicFilter = true;
          filterTenantId = matched.tenantId ? String(matched.tenantId).trim() : "";
        }
      } catch {}
    }

    const [matchedApts, allServices, allProviders, allPatients, allSettings] = await Promise.all([
      db.select().from(appointments).where(inArray(appointments.id, targetIds)),
      db.select().from(services),
      db.select().from(providers),
      db.select().from(patients),
      db.select().from(settings),
    ]);

    const serviceMap = new Map<string, string>();
    for (const s of allServices as any[]) {
      if (s?.id && s?.name) serviceMap.set(s.id, s.name);
      if (s?.originalId && s?.name && !serviceMap.has(s.originalId)) {
        serviceMap.set(s.originalId, s.name);
      }
    }
    const providerMap = new Map((allProviders as any[]).map((p) => [p.id, p]));
    const patientMap = new Map((allPatients as any[]).map((p) => [p.id, p]));

    const summaries = matchedApts
      .filter((apt: any) => {
        if (hasExplicitClinicFilter) {
          const aptTenantStr = apt.tenantId ? String(apt.tenantId).trim() : "";
          if (aptTenantStr !== filterTenantId) return false;
        }
        return true;
      })
      .map((apt: any) => {
        const aptTenantId = apt.tenantId ? String(apt.tenantId).trim() : null;
        const normalizedIds = Array.from(
          new Set(
            [apt.serviceId, ...(Array.isArray(apt.serviceIds) ? apt.serviceIds : [])]
              .filter(Boolean)
              .map((s: any) => String(s).trim())
          )
        );
        const serviceItems = normalizedIds.map((sId) => ({
          id: sId,
          name: serviceMap.get(sId) || apt.customServiceName || "Dịch vụ nha khoa",
        }));
        const resolvedServiceName =
          apt.customServiceName ||
          (serviceItems.length > 0 ? serviceItems.map((i) => i.name).join(" + ") : "Dịch vụ nha khoa");

        const profileSetting =
          (aptTenantId
            ? (allSettings as any[]).find(
                (s) =>
                  s.id === `${aptTenantId}__clinicProfile` ||
                  (s.id === "clinicProfile" && String(s.tenantId || "").trim() === aptTenantId)
              )
            : null) ||
          (allSettings as any[]).find((s) => s.id === "clinicProfile" && !s.tenantId) ||
          (allSettings as any[]).find((s) => s.id === "clinicProfile");
        const profileVal =
          profileSetting?.value && typeof profileSetting.value === "object" ? (profileSetting.value as any) : {};

        const pt = patientMap.get(apt.patientId);
        const pr = providerMap.get(apt.providerId);

        return {
          id: apt.id,
          status: apt.status,
          tenantId: aptTenantId,
          clinicName: profileVal.clinicName || profileVal.name || "Phòng khám Nha khoa",
          clinicSlug: profileVal.slug ? String(profileVal.slug).trim().toLowerCase() : null,
          clinicAddress: profileVal.address || "",
          clinicPhone: profileVal.phone || profileVal.hotline || "",
          latitude: typeof profileVal.latitude === "number" ? profileVal.latitude : null,
          longitude: typeof profileVal.longitude === "number" ? profileVal.longitude : null,
          startAt: apt.startAt,
          endAt: apt.endAt,
          serviceId: apt.serviceId || normalizedIds[0] || null,
          serviceIds: normalizedIds,
          serviceName: resolvedServiceName,
          providerName: pr?.name || profileVal.doctorName || "Bác sĩ chuyên khoa",
          patientName: apt.bookedForName || pt?.fullName || "Quý khách",
          cancelReason: apt.cancelReason || null,
          updatedAt: apt.updatedAt || apt.createdAt || null,
          rating: apt.rating ?? null,
          reviewedAt: apt.reviewedAt ?? null,
        };
      });

    res.json({ success: true, data: summaries });
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
        tenantId: appointments.tenantId,
        patientId: appointments.patientId,
        status: appointments.status,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        serviceId: appointments.serviceId,
        serviceIds: appointments.serviceIds,
        customServiceName: appointments.customServiceName,
        bookedForName: appointments.bookedForName,
        cancelReason: appointments.cancelReason,
        serviceName: services.name,
        providerName: providers.name,
        rating: appointments.rating,
        serviceRatings: appointments.serviceRatings,
        reviewComment: appointments.reviewComment,
        reviewTags: appointments.reviewTags,
        reviewedAt: appointments.reviewedAt,
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .where(eq(appointments.id, id))
      .limit(1);

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }

    const row = results[0] as any;
    const [allServices, allPatients, allSettings] = await Promise.all([
      db.select().from(services),
      db.select().from(patients).where(eq(patients.id, row.patientId)).limit(1),
      db.select().from(settings),
    ]);

    const serviceMap = new Map<string, string>();
    for (const s of allServices as any[]) {
      if (s?.id && s?.name) serviceMap.set(s.id, s.name);
      if (s?.originalId && s?.name && !serviceMap.has(s.originalId)) {
        serviceMap.set(s.originalId, s.name);
      }
    }

    const normalizedIds = Array.from(
      new Set(
        [
          row.serviceId,
          ...(Array.isArray(row.serviceIds) ? row.serviceIds : []),
        ]
          .filter(Boolean)
          .map((s: any) => String(s).trim())
      )
    );
    const serviceItems = normalizedIds.map((sId) => ({
      id: sId,
      name: serviceMap.get(sId) || row.serviceName || row.customServiceName || "Dịch vụ nha khoa",
    }));
    const resolvedServiceName =
      row.customServiceName ||
      (serviceItems.length > 0 ? serviceItems.map((i) => i.name).join(" + ") : row.serviceName || "Dịch vụ nha khoa");

    const rowTenantId = row.tenantId ? String(row.tenantId).trim() : null;
    const profileSetting =
      (rowTenantId
        ? (allSettings as any[]).find(
            (s) =>
              s.id === `${rowTenantId}__clinicProfile` ||
              (s.id === "clinicProfile" && String(s.tenantId || "").trim() === rowTenantId)
          )
        : null) ||
      (allSettings as any[]).find((s) => s.id === "clinicProfile" && !s.tenantId) ||
      (allSettings as any[]).find((s) => s.id === "clinicProfile");
    const profileVal =
      profileSetting?.value && typeof profileSetting.value === "object" ? (profileSetting.value as any) : {};

    res.json({
      success: true,
      data: {
        id: row.id,
        tenantId: rowTenantId,
        clinicName: profileVal.clinicName || profileVal.name || "Phòng khám Nha khoa",
        clinicSlug: profileVal.slug ? String(profileVal.slug).trim().toLowerCase() : null,
        clinicAddress: profileVal.address || "",
        clinicPhone: profileVal.phone || profileVal.hotline || "",
        latitude: typeof profileVal.latitude === "number" ? profileVal.latitude : null,
        longitude: typeof profileVal.longitude === "number" ? profileVal.longitude : null,
        status: row.status,
        startAt: row.startAt,
        endAt: row.endAt,
        serviceId: row.serviceId || normalizedIds[0] || null,
        serviceIds: normalizedIds,
        serviceItems,
        serviceName: resolvedServiceName,
        providerName: row.providerName || profileVal.doctorName || "Bác sĩ chuyên khoa",
        patientName: row.bookedForName || allPatients[0]?.fullName || "Quý khách",
        cancelReason: row.cancelReason ?? null,
        rating: row.rating ?? null,
        serviceRatings: row.serviceRatings ?? null,
        reviewComment: row.reviewComment ?? null,
        reviewTags: row.reviewTags ?? null,
        reviewedAt: row.reviewedAt ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

function stripSystemBookingTags(raw?: string | null): string {
  if (!raw) return "";
  return String(raw)
    .replace(/\[Đặt lịch hộ qua SĐT[^\]]*\]\s*/gi, "")
    .replace(/\[Đặt lịch hộ cho:[^\]]*\]\s*-?\s*/gi, "")
    .replace(/\[Đặt lịch hộ[^\]]*\]\s*-?\s*/gi, "")
    .replace(/\[Đặt cho người thân\]\s*-?\s*/gi, "")
    .replace(/\[HỆ THỐNG\]:[^\n]*\n?/gi, "")
    .replace(/^\s*[-–|]\s*/, "")
    .trim();
}

function isPatientProxyRecord(p: any): boolean {
  if (!p) return false;
  if (p.bookingFor === "relative") return true;
  if (p.bookingFor === "self") return false;
  if (p.isProxyBooking === true) return true;
  if (p.notes) {
    try {
      const parsed = JSON.parse(p.notes);
      if (parsed && typeof parsed === "object") {
        if (parsed.bookingFor === "relative") return true;
        if (parsed.bookingFor === "self") return false;
        if (parsed.isProxyBooking === true) return true;
        if (parsed.text && (parsed.text.includes("[Đặt lịch hộ") || parsed.text.includes("[Đặt cho người thân]"))) {
          return true;
        }
      }
    } catch {
      if (String(p.notes).includes("[Đặt lịch hộ") || String(p.notes).includes("[Đặt cho người thân]")) {
        return true;
      }
    }
  }
  return false;
}

function resolveAppointmentMode(apt: any, pt?: any): "self" | "relative" {
  if (apt?.bookingFor === "relative") return "relative";
  if (apt?.bookingFor === "self") return "self";
  if (apt?.isProxyBooking === true) return "relative";
  if (apt?.notes && (apt.notes.includes("[Đặt lịch hộ") || apt.notes.includes("[Đặt cho người thân]"))) {
    return "relative";
  }
  if (pt && isPatientProxyRecord(pt)) return "relative";
  return "self";
}

async function buildBookingHistoryList(patientIds: string[], patientRows: any[]) {
  if (!patientIds || patientIds.length === 0) return [];
  const rawList = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      serviceId: appointments.serviceId,
      serviceIds: appointments.serviceIds,
      serviceName: services.name,
      customServiceName: appointments.customServiceName,
      providerName: providers.name,
      notes: appointments.notes,
      bookingFor: (appointments as any).bookingFor,
      isProxyBooking: (appointments as any).isProxyBooking,
      bookedForName: (appointments as any).bookedForName,
      cancelReason: appointments.cancelReason,
      rating: appointments.rating,
      serviceRatings: (appointments as any).serviceRatings,
      reviewComment: appointments.reviewComment,
      reviewTags: appointments.reviewTags,
      reviewedAt: appointments.reviewedAt,
      isReviewHidden: appointments.isReviewHidden,
      isRatingHidden: appointments.isRatingHidden,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(providers, eq(appointments.providerId, providers.id))
    .where(inArray(appointments.patientId, patientIds));

  const allServices = await db.select().from(services);
  const serviceNameMap = new Map<string, string>();
  for (const s of allServices as any[]) {
    if (s?.id && s?.name) serviceNameMap.set(s.id, s.name);
    if (s?.originalId && s?.name && !serviceNameMap.has(s.originalId)) {
      serviceNameMap.set(s.originalId, s.name);
    }
  }

  const ptMap = new Map(patientRows.map((p: any) => [p.id, p]));
  return rawList
    .map((r: any) => {
      const pt = ptMap.get(r.patientId);
      const mode = resolveAppointmentMode(r, pt);
      const targetName = r.bookedForName || pt?.fullName || "Khách hàng";
      const normalizedIds = Array.from(
        new Set(
          [
            r.serviceId,
            ...(Array.isArray(r.serviceIds) ? r.serviceIds : []),
          ].filter(Boolean)
        )
      );
      const serviceItems = normalizedIds.map((sId) => ({
        id: sId,
        name: serviceNameMap.get(sId) || r.serviceName || "Dịch vụ nha khoa",
      }));
      const resolvedMultiName =
        serviceItems.length > 1
          ? serviceItems.map((item) => item.name).join(" + ")
          : serviceItems[0]?.name || r.serviceName;

      return {
        ...r,
        serviceIds: normalizedIds,
        serviceItems,
        serviceName: r.customServiceName || resolvedMultiName || "Khám nha khoa",
        patientName: targetName,
        bookedForName: targetName,
        bookingFor: mode,
        isProxyBooking: mode === "relative",
        notes: stripSystemBookingTags(r.notes),
      };
    })
    .sort((a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

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

    const cleanedPhone = String(phone).replace(/\D/g, "");
    const phoneVariants = new Set<string>([cleanedPhone]);
    if (cleanedPhone.startsWith("84")) {
      phoneVariants.add("0" + cleanedPhone.slice(2));
      phoneVariants.add(cleanedPhone.slice(2));
    } else if (cleanedPhone.startsWith("0")) {
      phoneVariants.add("84" + cleanedPhone.slice(1));
      phoneVariants.add(cleanedPhone.slice(1));
    } else if (cleanedPhone.length >= 9) {
      phoneVariants.add("0" + cleanedPhone);
      phoneVariants.add("84" + cleanedPhone);
    }

    const allPts = await db.select().from(patients);
    const pts = allPts.filter((p: any) => p.phone && phoneVariants.has(String(p.phone).replace(/\D/g, "")));
    if (pts.length === 0) {
      return res.json({ success: true, data: [], allBookingHistory: [] });
    }
    
    const patientIds = pts.map(p => p.id);
    const results = await buildBookingHistoryList(patientIds, pts);
    let finalResults = results;
    let allBookingHistory = results;
    let patientDob = null;
    
    // Lọc theo code hoặc fullName
    if (code) {
      finalResults = results.filter(r => r.id.includes(code) || r.id === code);
      allBookingHistory = finalResults;
    } else if (fullName) {
      const inputNameNorm = normalizeName(fullName);
      const matchedPatient = pts.find(p => normalizeName(p.fullName) === inputNameNorm);
      
      if (!matchedPatient) {
        return res.status(403).json({ success: false, error: { message: "Họ tên không khớp với số điện thoại đã đăng ký. Vui lòng kiểm tra lại để bảo mật thông tin." } });
      }
      
      patientDob = matchedPatient.dob;
      const matchedIsProxy = isPatientProxyRecord(matchedPatient);
      if (matchedIsProxy) {
        finalResults = results.filter(r => r.patientId === matchedPatient.id);
        allBookingHistory = finalResults;
      } else {
        // Primary profile sees their own bookings + any proxy bookings placed via their phone
        const allowedPatientIds = new Set(
          pts
            .filter((p: any) => {
              if (matchedPatient.tenantId && p.tenantId && p.tenantId !== matchedPatient.tenantId) return false;
              return p.id === matchedPatient.id || isPatientProxyRecord(p);
            })
            .map((p: any) => p.id)
        );
        finalResults = results.filter(r => r.patientId === matchedPatient.id);
        allBookingHistory = results.filter(r => allowedPatientIds.has(r.patientId) || r.isProxyBooking === true);
      }
    }
    
    if (code) {
      // If looked up by exact code, just return it
      return res.json({ success: true, data: finalResults, allBookingHistory });
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
          data: upcoming,
          allBookingHistory,
          hasHistory: true 
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: finalResults,
      allBookingHistory,
      hasHistory: false
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.patch("/appointments/:id/cancel", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone, reason } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: { message: "Cần xác thực bằng số điện thoại để hủy lịch" } });
    }
    
    const apts = await db.select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      patientId: appointments.patientId,
      serviceId: appointments.serviceId,
      status: appointments.status,
      providerId: appointments.providerId,
      startAt: appointments.startAt
    }).from(appointments).where(eq(appointments.id, id)).limit(1);
    
    if (apts.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }
    
    const pt = await db.select().from(patients).where(eq(patients.id, apts[0].patientId)).limit(1);
    const rawPhone = String(phone).replace(/\D/g, "");
    const ptPhone = (pt.length > 0 && pt[0].phone) ? String(pt[0].phone).replace(/\D/g, "") : "";
    
    // So sánh linh hoạt hơn với 9 số cuối
    if (pt.length === 0 || !ptPhone || !rawPhone || ptPhone.slice(-9) !== rawPhone.slice(-9)) {
      return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với hồ sơ đặt lịch" } });
    }
    
    if (apts[0].status !== 'REQUESTED' && apts[0].status !== 'PENDING' && apts[0].status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, error: { message: "Không thể hủy lịch ở trạng thái hiện tại" } });
    }

    const cancelReasonText = reason ? String(reason).trim() : "Khách hàng chủ động hủy lịch";
    await db.update(appointments).set({
      status: 'CANCEL_PATIENT',
      cancelReason: cancelReasonText,
      updatedAt: new Date(),
    }).where(eq(appointments.id, id));
    
    // Send Push Notification (VAPID), Waitlist matching, and multichannel alert to patient
    sendAppointmentStatusPush(id, 'CANCEL_PATIENT', { cancelReason: cancelReasonText }).catch(console.error);
    notifyPatientAppointment(id, 'CANCELLED', cancelReasonText, { skipWebPush: true }).catch(console.error);
    import('../../jobs/waitlistMatcher.js')
      .then(({ triggerWaitlistMatching }) => triggerWaitlistMatching(apts[0]))
      .catch(console.error);

    import('../../services/appointmentFirestoreService.js')
      .then(({ syncAppointmentToFirestore }) => syncAppointmentToFirestore(id))
      .catch(() => {});

    import('../../services/realtimeNotification.js').then(({ realtimeNotification }) => {
      realtimeNotification.emitBookingUpdated({
        id,
        tenantId: apts[0].tenantId || null,
        patientName: pt[0]?.fullName,
        startAt: apts[0].startAt,
        action: 'cancel',
      });
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
      tenantId: appointments.tenantId,
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
    
    // Send Push Notification (VAPID) to patient
    sendAppointmentStatusPush(id, 'RESCHEDULED', { newStartAt: startAt }).catch(console.error);
    notifyPatientAppointment(id, 'RESCHEDULED', undefined, { skipWebPush: true }).catch(console.error);

    import('../../services/appointmentFirestoreService.js')
      .then(({ syncAppointmentToFirestore }) => syncAppointmentToFirestore(id))
      .catch(() => {});

    import('../../services/realtimeNotification.js').then(({ realtimeNotification }) => {
      realtimeNotification.emitBookingUpdated({
        id,
        tenantId: apts[0].tenantId || null,
        patientName: pt[0]?.fullName,
        startAt: startAt.toISOString(),
        action: 'reschedule',
      });
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

// Bệnh nhân gửi đánh giá sao sau khi hoàn tất ca khám
publicRouter.post("/appointments/:id/review", patientVerifyLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, serviceRatings: rawServiceRatings, reviewComment, reviewTags, phone, bookingCode } = req.body || {};

    const hasServiceRatingsInput =
      rawServiceRatings &&
      typeof rawServiceRatings === "object" &&
      Object.keys(rawServiceRatings).length > 0;

    if ((rating === undefined || rating === null) && !hasServiceRatingsInput) {
      return res.status(400).json({ success: false, error: { message: "Vui lòng chọn số sao đánh giá (1-5 sao)" } });
    }

    const aptList = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (aptList.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }

    const apt = aptList[0];

    // Enforce multi-tenant isolation if tenant context is set
    const ctxTenant = appContext.getStore()?.tenantId || null;
    if (ctxTenant && apt.tenantId && String(apt.tenantId).trim() !== String(ctxTenant).trim()) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn tại phòng khám này" } });
    }

    // Only allow reviewing appointments that are COMPLETED
    if (String(apt.status || "").toUpperCase() !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        error: { message: "Chỉ có thể đánh giá sao sau khi lịch hẹn đã hoàn tất khám." }
      });
    }

    // Mandatory ownership verification via phone OR full matching booking ID
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanCode = String(bookingCode || "").trim();
    const isCodeVerified = Boolean(
      cleanCode &&
        (cleanCode === apt.id ||
          (cleanCode.length >= 12 && apt.id.toLowerCase().startsWith(cleanCode.toLowerCase())))
    );

    if (!cleanPhone && !isCodeVerified) {
      return res.status(403).json({
        success: false,
        error: { message: "Vui lòng xác thực bằng số điện thoại đặt lịch trước khi gửi đánh giá." }
      });
    }

    if (cleanPhone) {
      const ptList = await db.select().from(patients).where(eq(patients.id, apt.patientId)).limit(1);
      if (ptList.length > 0 && ptList[0].phone) {
        const ptCleanPhone = String(ptList[0].phone).replace(/\D/g, "");
        const tailInput = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
        const tailStored = ptCleanPhone.length >= 9 ? ptCleanPhone.slice(-9) : ptCleanPhone;
        if (!tailInput || !tailStored || tailInput !== tailStored) {
          return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với lịch hẹn này" } });
        }
      }
    }

    const { normalizeServiceRatingsMap, computeOverallRatingFromMap, clampRatingValue } = await import(
      "../../services/reviewAggregation.js"
    );

    const registeredServiceIds = Array.from(
      new Set(
        [
          apt.serviceId,
          ...(Array.isArray(apt.serviceIds) ? apt.serviceIds : []),
        ].filter(Boolean).map((x: any) => String(x).trim())
      )
    );

    const explicitNumericRating = clampRatingValue(rating);
    const normalizedServiceRatings = normalizeServiceRatingsMap(
      rawServiceRatings,
      registeredServiceIds,
      explicitNumericRating
    );

    const finalOverallRating = computeOverallRatingFromMap(
      normalizedServiceRatings,
      explicitNumericRating
    );

    const updated = await appContext.run({ tenantId: apt.tenantId || ctxTenant || null, isFullAdmin: !apt.tenantId && !ctxTenant }, async () => {
      return await db.update(appointments).set({
        rating: finalOverallRating,
        serviceRatings: normalizedServiceRatings,
        reviewComment: reviewComment ? String(reviewComment).trim().slice(0, 500) : "",
        reviewTags: Array.isArray(reviewTags) ? reviewTags.slice(0, 10) : [],
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(appointments.id, id)).returning();
    });

    // Clear clinic slug bundle cache & notify clinic admin dashboard in real-time
    try {
      const { invalidateClinicSlugCache } = await import("../../services/clinicFirestoreService.js");
      invalidateClinicSlugCache();
    } catch {}

    import("../../services/appointmentFirestoreService.js")
      .then(({ syncAppointmentToFirestore }) => syncAppointmentToFirestore(apt.id))
      .catch(() => {});

    try {
      const { realtimeNotification } = await import("../../services/realtimeNotification.js");
      const [ptRows, svcRows] = await Promise.all([
        db.select().from(patients).where(eq(patients.id, apt.patientId)).limit(1),
        apt.serviceId ? db.select().from(services).where(eq(services.id, apt.serviceId)).limit(1) : Promise.resolve([]),
      ]);
      realtimeNotification.emitBookingUpdated({
        id: apt.id,
        status: apt.status,
        tenantId: apt.tenantId || ctxTenant || null,
        rating: finalOverallRating,
        serviceRatings: normalizedServiceRatings,
        serviceName: apt.customServiceName || (svcRows as any[])[0]?.name || undefined,
        reviewComment: updated[0]?.reviewComment || "",
        reviewedAt: updated[0]?.reviewedAt || new Date().toISOString(),
        patientName: apt.bookedForName || ptRows[0]?.fullName || "Khách hàng",
        action: "reviewed",
      });
    } catch {}

    res.json({
      success: true,
      message: "Cảm ơn bạn đã gửi đánh giá! Dữ liệu điểm sao dịch vụ đã được ghi nhận.",
      data: updated[0]
    });
  } catch (error) {
    next(error);
  }
});

// Lấy danh sách đánh giá công khai & thống kê độ uy tín nha khoa / từng dịch vụ
publicRouter.get("/reviews", async (req, res, next) => {
  try {
    let targetTenantId = (req.query.tenantId || req.headers["x-tenant-id"] || appContext.getStore()?.tenantId) as string | undefined;
    const rawClinicSlug = (req.query.clinic || req.query.slug || "") as string;
    if (!targetTenantId && rawClinicSlug) {
      const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
      const matched = await findClinicBySlug(rawClinicSlug.trim());
      if (matched?.tenantId) {
        targetTenantId = matched.tenantId;
      }
    }

    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId.trim() : undefined;
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));

    const { getPublicReviewsSummary } = await import("../../services/reviewAggregation.js");
    const summaryData = await getPublicReviewsSummary({
      tenantId: targetTenantId || null,
      serviceId: serviceId || null,
      limit,
    });

    res.json({
      success: true,
      data: summaryData,
    });
  } catch (error) {
    next(error);
  }
});

// PWA Installation telemetry and metric tracking
publicRouter.post("/pwa-install", async (req, res, next) => {
  try {
    const { platform = "pc", displayMode = "standalone", installedAt } = req.body || {};
    const safePlatform = ['pc', 'android', 'ios'].includes(platform) ? platform : 'pc';
    const safeDisplayMode = ['standalone', 'shortcut'].includes(displayMode) ? displayMode : 'standalone';

    const record = await db.select().from(settings).where(eq(settings.id, "pwa_install_stats")).limit(1);
    const existingStats = record[0]?.value || {
      totalInstalls: 0,
      platforms: { pc: 0, android: 0, ios: 0 },
      displayModes: { standalone: 0, shortcut: 0 },
      recentInstalls: []
    };

    const updatedStats = {
      totalInstalls: (existingStats.totalInstalls || 0) + 1,
      platforms: {
        pc: (existingStats.platforms?.pc || 0) + (safePlatform === 'pc' ? 1 : 0),
        android: (existingStats.platforms?.android || 0) + (safePlatform === 'android' ? 1 : 0),
        ios: (existingStats.platforms?.ios || 0) + (safePlatform === 'ios' ? 1 : 0),
      },
      displayModes: {
        standalone: (existingStats.displayModes?.standalone || 0) + (safeDisplayMode === 'standalone' ? 1 : 0),
        shortcut: (existingStats.displayModes?.shortcut || 0) + (safeDisplayMode === 'shortcut' ? 1 : 0),
      },
      recentInstalls: [
        {
          platform: safePlatform,
          displayMode: safeDisplayMode,
          installedAt: installedAt || new Date().toISOString(),
          userAgent: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 120) : undefined,
        },
        ...(Array.isArray(existingStats.recentInstalls) ? existingStats.recentInstalls.slice(0, 49) : [])
      ]
    };

    await db.insert(settings)
      .values({ id: "pwa_install_stats", value: updatedStats })
      .onConflictDoUpdate({ target: settings.id, set: { value: updatedStats } });

    res.json({ success: true, message: "Ghi nhận cài đặt PWA thành công" });
  } catch (error) {
    console.warn("[PWA Install Metric] Error saving metric:", error);
    res.json({ success: false });
  }
});

// Dedicated Web App Manifest for Clinic Admin Mobile App (Home Screen Launcher)
publicRouter.get("/admin-manifest.webmanifest", (req, res) => {
  const rawSlug = typeof req.query.slug === "string" ? req.query.slug.trim().toLowerCase() : "";
  const rawName = typeof req.query.name === "string" ? req.query.name.trim() : "";
  const clinicTitle = rawName ? `Quản Lý - ${rawName}` : "Quản Lý Phòng Khám Nha Khoa";
  const startUrl = rawSlug ? `/admin/dashboard?clinic=${encodeURIComponent(rawSlug)}` : "/admin/dashboard";

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.json({
    id: rawSlug ? `/admin/dashboard?clinic=${rawSlug}` : "/admin/dashboard",
    name: clinicTitle,
    short_name: "Quản Lý PK",
    description: "Ứng dụng quản trị lịch hẹn và nhận thông báo đặt lịch trực tiếp trên điện thoại",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  });
});

function buildClinicShortName(rawName: string): string {
  const cleaned = rawName.replace(/^nha\s+khoa\s+/i, "").trim() || rawName.trim();
  if (!cleaned) return "Đặt Lịch";
  if (cleaned.length <= 12) return cleaned;
  const words = cleaned.split(/\s+/);
  let acc = "";
  for (const w of words) {
    const candidate = acc ? `${acc} ${w}` : w;
    if (candidate.length <= 12) acc = candidate;
    else break;
  }
  return acc || cleaned.slice(0, 12);
}

// Dynamic Per-Clinic Web App Manifest for Customer Booking PWA (Android / iOS / PC)
publicRouter.get("/clinic-manifest.webmanifest", async (req, res) => {
  const rawSlug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  let clinicName = typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!clinicName && rawSlug) {
    try {
      const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
      const matched = await findClinicBySlug(rawSlug);
      if (matched?.clinicName) {
        clinicName = String(matched.clinicName).trim();
      }
    } catch {
      // Fallback safely
    }
  }

  const startUrl = rawSlug
    ? `/booking/${encodeURIComponent(rawSlug)}?mode=customer`
    : "/";
  const fullName = clinicName
    ? `${clinicName} - Đặt Lịch Khám`
    : "Dental Smart - Đặt Lịch Khám Nha Khoa";
  const shortName = clinicName ? buildClinicShortName(clinicName) : "Đặt Lịch";

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.json({
    id: startUrl,
    name: fullName,
    short_name: shortName,
    description: clinicName
      ? `Đặt lịch khám trực tuyến tại ${clinicName}`
      : "Đặt lịch hẹn khám nha khoa nhanh chóng, tiện lợi",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  });
});

// Auto-create Windows Desktop Shortcut Script (.bat with UTF-16LE Encoded PowerShell)
publicRouter.get("/pc-shortcut-script", (req, res) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const rawName = typeof req.query.name === "string" ? req.query.name.trim() : "Dat Lich Phong Kham";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
    }
  } catch {
    return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
  }

  const displayTitle = rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Dat Lich Phong Kham";
  const asciiFilenameBase =
    displayTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Dat_Lich_Kham";

  const targetUrl = parsedUrl.toString();
  const faviconUrl = `${parsedUrl.origin}/favicon.ico`;

  // Escape single quotes for PowerShell single-quoted literals
  const psEscape = (val: string) => val.replace(/'/g, "''");

  const psScript = `
$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path $desktop)) {
  $desktop = Join-Path $env:USERPROFILE 'Desktop'
}
$appUrl = '${psEscape(targetUrl)}'
$appName = '${psEscape(displayTitle)}'
$iconDir = Join-Path $env:LOCALAPPDATA 'DentalSmart\\Icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
$iconPath = Join-Path $iconDir '${psEscape(asciiFilenameBase)}.ico'
try {
  Invoke-WebRequest -Uri '${psEscape(faviconUrl)}' -OutFile $iconPath -TimeoutSec 5 -UseBasicParsing
} catch {}

$browserExe = $null
$browserArgs = $null
$candidates = @(
  "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
  "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe",
  "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe",
  "\${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:LOCALAPPDATA\\CocCoc\\Browser\\Application\\browser.exe",
  "$env:ProgramFiles\\CocCoc\\Browser\\Application\\browser.exe"
)
foreach ($c in $candidates) {
  if ($c -and (Test-Path $c)) {
    $browserExe = $c
    $browserArgs = "--app=$appUrl"
    break
  }
}

$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $desktop ($appName + '.lnk')
$sc = $ws.CreateShortcut($lnkPath)
if ($browserExe) {
  $sc.TargetPath = $browserExe
  $sc.Arguments = $browserArgs
  if (Test-Path $iconPath) {
    $sc.IconLocation = "$iconPath,0"
  } else {
    $sc.IconLocation = "$browserExe,0"
  }
} else {
  $sc.TargetPath = $appUrl
  if (Test-Path $iconPath) {
    $sc.IconLocation = "$iconPath,0"
  }
}
$sc.Description = $appName
$sc.Save()
Write-Host ("CREATED: " + $lnkPath)
`.trim();

  const encodedCommand = Buffer.from(psScript, "utf16le").toString("base64");

  const batContent = [
    "@echo off",
    "chcp 65001 >nul",
    "title Cai dat loi tat Desktop",
    "echo ========================================================",
    "echo   DANG TAO BIEU TUONG UNG DUNG TREN MAN HINH DESKTOP...",
    "echo ========================================================",
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`,
    "if %errorlevel% equ 0 (",
    "  echo.",
    "  echo [OK] Da tao bieu tuong loi tat tren Man hinh Desktop!",
    "  echo Ban co the mo ung dung ngay tu Man hinh Desktop.",
    "  timeout /t 2 >nul",
    ") else (",
    "  echo.",
    "  echo [LOI] Khong the tao loi tat tu dong. Vui long thu cach khac trong trinh duyet.",
    "  pause",
    ")",
    "",
  ].join("\r\n");

  res.setHeader("Content-Type", "application/bat; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Cai_Dat_${asciiFilenameBase}.bat"`
  );
  res.send(batContent);
});

// Helper: build valid Android package ID and TWA manifest for Bubblewrap CLI
function buildAndroidTwaManifestData(params: {
  targetUrl: string;
  clinicName: string;
  slug?: string;
  customPackageId?: string;
}) {
  const parsedUrl = new URL(params.targetUrl);
  const rawName = params.clinicName.trim() || "Nha Khoa Dental Smart";
  const shortName = buildClinicShortName(rawName);
  const cleanSlug = (params.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  let packageId = (params.customPackageId || "").trim();
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(packageId)) {
    const pkgSuffix = cleanSlug
      ? cleanSlug
      : parsedUrl.hostname
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase()
          .slice(0, 18) || "clinic";
    const safeSuffix = /^[a-z]/.test(pkgSuffix) ? pkgSuffix : `c${pkgSuffix}`;
    packageId = `com.dentalsmart.${safeSuffix.slice(0, 28)}`;
  }

  const startUrl = `${parsedUrl.pathname || "/"}${parsedUrl.search || ""}`;
  const webManifestUrl = params.slug
    ? `${parsedUrl.origin}/api/public/clinic-manifest.webmanifest?slug=${encodeURIComponent(params.slug)}&name=${encodeURIComponent(rawName)}`
    : `${parsedUrl.origin}/manifest.webmanifest`;

  return {
    packageId,
    host: parsedUrl.host,
    name: `${rawName} - Đặt Lịch Khám`,
    launcherName: shortName,
    display: "standalone",
    themeColor: "#0d9488",
    themeColorDark: "#0f766e",
    navigationColor: "#0d9488",
    navigationColorDark: "#0f766e",
    navigationDividerColor: "#0d9488",
    navigationDividerColorDark: "#0f766e",
    backgroundColor: "#ffffff",
    enableNotifications: true,
    startUrl,
    iconUrl: `${parsedUrl.origin}/pwa-512x512.png`,
    maskableIconUrl: `${parsedUrl.origin}/pwa-maskable-512x512.png`,
    monochromeIconUrl: `${parsedUrl.origin}/pwa-192x192.png`,
    splashScreenFadeOutDuration: 300,
    signingKey: {
      path: "./android.keystore",
      alias: "android",
    },
    appVersionName: "1.0.0",
    appVersionCode: 1,
    shortcuts: [],
    generatorApp: "bubblewrap-cli",
    webManifestUrl,
    fallbackType: "customtabs",
    features: {
      locationDelegation: {
        enabled: true,
      },
    },
    alphaDependencies: {
      enabled: false,
    },
    enableSiteSettingsShortcut: true,
    isChromeOSOnly: false,
    isMetaQuest: false,
    fullScopeUrl: `${parsedUrl.origin}/`,
    minSdkVersion: 21,
    orientation: "portrait-primary",
    fingerprints: [],
    additionalTrustedOrigins: [],
    retainedBundles: [],
    protocolHandlers: [],
    fileHandlers: [],
    launchHandlerClientMode: "",
    appVersion: "1",
  };
}

// Dynamic Google Bubblewrap twa-manifest.json for building a signed Android APK
publicRouter.get("/android-twa-manifest", (req, res) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const rawName = typeof req.query.name === "string" ? req.query.name.trim() : "Nha Khoa Dental Smart";
  const rawSlug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  const rawPkg = typeof req.query.pkg === "string" ? req.query.pkg.trim() : "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
    }
  } catch {
    return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
  }

  const manifest = buildAndroidTwaManifestData({
    targetUrl: parsedUrl.toString(),
    clinicName: rawName,
    slug: rawSlug,
    customPackageId: rawPkg,
  });

  if (req.query.preview !== "1") {
    res.setHeader("Content-Disposition", 'attachment; filename="twa-manifest.json"');
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(manifest, null, 2));
});

// Windows Helper Script (.bat) powered by Google @bubblewrap/cli to compile & sign a real app-release-signed.apk
publicRouter.get("/android-apk-builder", (req, res) => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const rawName = typeof req.query.name === "string" ? req.query.name.trim() : "Nha Khoa Dental Smart";
  const rawSlug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  const rawPkg = typeof req.query.pkg === "string" ? req.query.pkg.trim() : "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
    }
  } catch {
    return res.status(400).json({ success: false, error: { message: "URL không hợp lệ" } });
  }

  const displayTitle =
    rawName.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) ||
    "Dental_Smart";
  const asciiFilenameBase =
    displayTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Dental_Smart";

  const twaManifestUrl = `${parsedUrl.origin}/api/public/android-twa-manifest?url=${encodeURIComponent(
    parsedUrl.toString()
  )}&name=${encodeURIComponent(displayTitle)}&slug=${encodeURIComponent(rawSlug)}&pkg=${encodeURIComponent(rawPkg)}&preview=1`;

  const webManifestUrl = rawSlug
    ? `${parsedUrl.origin}/api/public/clinic-manifest.webmanifest?slug=${encodeURIComponent(
        rawSlug
      )}&name=${encodeURIComponent(displayTitle)}`
    : `${parsedUrl.origin}/manifest.webmanifest`;

  const twaPreview = buildAndroidTwaManifestData({
    targetUrl: parsedUrl.toString(),
    clinicName: displayTitle,
    slug: rawSlug,
    customPackageId: rawPkg,
  });

  const psDownloadScript = `$ErrorActionPreference = 'Stop'; Invoke-WebRequest -Uri '${twaManifestUrl.replace(/'/g, "''")}' -OutFile 'twa-manifest.json' -UseBasicParsing`;
  const psDownloadEncoded = Buffer.from(psDownloadScript, "utf16le").toString("base64");
  const batSafeWebManifestUrl = webManifestUrl.replace(/%/g, "%%");

  const batContent = [
    "@echo off",
    "chcp 65001 >nul",
    `title Dong goi App Android (.APK) - ${asciiFilenameBase}`,
    "echo ======================================================================",
    `echo   CONG CU DONG GOI FILE .APK CHINH CHU GOOGLE TWA - ${asciiFilenameBase}`,
    `echo   Package ID: ${twaPreview.packageId}`,
    "echo ======================================================================",
    "echo.",
    "where node >nul 2>nul",
    "if %errorlevel% neq 0 (",
    "  echo [LOI] May tinh chua cai dat Node.js!",
    "  echo Vui long cai Node.js LTS tai https://nodejs.org roi chay lai file nay.",
    "  start https://nodejs.org/",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    `set "APK_DIR=%USERPROFILE%\\Desktop\\APK_${asciiFilenameBase}"`,
    `if not exist "%APK_DIR%" mkdir "%APK_DIR%"`,
    `cd /d "%APK_DIR%"`,
    "echo [1/3] Dang tai cau hinh Web App Manifest & TWA...",
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${psDownloadEncoded}`,
    "if %errorlevel% neq 0 (",
    "  echo [LOI] Khong the tai twa-manifest.json tu may chu.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "echo [2/3] Dang khoi tao & cap nhat ma nguon Android (Google Bubblewrap CLI)...",
    "echo (Neu la lan dau chay, vui long nhan Enter/Y de dong y tai JDK & Android SDK tu Google)",
    `if not exist "%USERPROFILE%\\.bubblewrap\\config.json" (`,
    `  call npx --yes @bubblewrap/cli init --manifest="${batSafeWebManifestUrl}"`,
    `) else if not exist "app\\build.gradle" (`,
    `  call npx --yes @bubblewrap/cli update`,
    `)`,
    "",
    "echo [3/3] Dang bien dich & ky so file app-release-signed.apk...",
    "call npx --yes @bubblewrap/cli build",
    "if %errorlevel% equ 0 (",
    "  echo.",
    "  echo ======================================================================",
    "  echo [THANH CONG] Da dong goi xong file APK tai thu muc:",
    `  echo %APK_DIR%\\app-release-signed.apk`,
    "  echo Ban co the gui file .apk nay sang dien thoai Android de cai dat ngay!",
    "  echo ======================================================================",
    `  explorer "%APK_DIR%"`,
    "  pause",
    ") else (",
    "  echo.",
    "  echo [LOI] Qua trinh dong goi APK chua hoan tat. Kiem tra thong bao ben tren.",
    "  pause",
    ")",
    "",
  ].join("\r\n");

  res.setHeader("Content-Type", "application/bat; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Dong_Goi_APK_${asciiFilenameBase}.bat"`
  );
  res.send(batContent);
});

// Runtime Google OAuth Client ID configuration (public identifier, synced across all browsers/devices)
publicRouter.get("/google-oauth-config", async (req, res, next) => {
  try {
    let targetTenantId = (req.query.tenantId || req.headers["x-tenant-id"] || appContext.getStore()?.tenantId || "")
      .toString()
      .trim() || null;

    const rawClinicSlug = (req.query.clinic || req.query.slug || req.query.clinicSlug || "")
      .toString()
      .trim();

    if (!targetTenantId && rawClinicSlug) {
      try {
        const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
        const matched = await findClinicBySlug(rawClinicSlug);
        if (matched?.tenantId) {
          targetTenantId = matched.tenantId;
        }
      } catch {
        // Ignore lookup error and fall back cleanly
      }
    }

    const allSettings = await db.select().from(settings);
    const tenantConfig = targetTenantId
      ? allSettings.find(
          (s: any) =>
            (s.id === "google_oauth_client_id" || s.key === "google_oauth_client_id") &&
            s.tenantId === targetTenantId &&
            typeof s.value === "string" &&
            s.value.trim().length > 0
        )
      : null;

    const globalConfig = allSettings.find(
      (s: any) =>
        (s.id === "google_oauth_client_id" || s.key === "google_oauth_client_id") &&
        !s.tenantId &&
        typeof s.value === "string" &&
        s.value.trim().length > 0
    );

    const envClientId = (
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_OAUTH_CLIENT_ID ||
      ""
    ).trim();

    const savedTenantClientId = tenantConfig?.value ? String(tenantConfig.value).trim() : "";
    const savedGlobalClientId = globalConfig?.value ? String(globalConfig.value).trim() : "";

    const clientId = savedTenantClientId || savedGlobalClientId || envClientId || "";
    const source = savedTenantClientId
      ? "tenant_setting"
      : savedGlobalClientId
        ? "global_setting"
        : envClientId
          ? "server_env"
          : "none";

    res.json({
      success: true,
      data: {
        clientId,
        source,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default publicRouter;
