import { Router } from "express";
import { db } from "../../db/index.js";
import { appointments, patients, providers, services, settings } from "../../db/schema.js";
import { sendPatientReminder } from "../../core/telegram.js";
import { eq, and, gte, lte, or, like, desc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { AppointmentQuerySchema, UpdateStatusSchema } from "../../../shared/appointment.js";
import { NotFoundError, BadRequestError } from "../../core/errors.js";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { safeFormatDate } from "../../utils/dateFormat.js";
import { sendWebPush, sendAppointmentStatusPush } from "../../services/notification.js";
import { triggerWaitlistMatching } from "../../jobs/waitlistMatcher.js";
import { generateRecall } from "../../jobs/recallGenerator.js";
import { getProviderOccupiedSlots, isSlotConflict } from "../../core/scheduling.js";
import { notifyPatientAppointment } from "../../services/patientNotification.js";
import { realtimeNotification } from "../../services/realtimeNotification.js";

const appointmentRouter = Router();

// Middleware yêu cầu đăng nhập cho toàn bộ Router này
appointmentRouter.use(requireAuth);

const HISTORY_STATUS_SET = new Set([
  "COMPLETED",
  "CANCEL_PATIENT",
  "CANCEL_CLINIC",
  "CANCELLED",
  "NO_SHOW",
]);

const CANCELLED_STATUS_SET = new Set([
  "CANCEL_PATIENT",
  "CANCEL_CLINIC",
  "CANCELLED",
  "NO_SHOW",
]);

function normalizeTenant(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRequestTenantId(req: any): string | null {
  return normalizeTenant(req.user?.tenantId);
}

function cleanSystemNotes(raw?: string | null): string {
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

function resolveMode(r: any): "self" | "relative" {
  if (r.bookingFor === "relative") return "relative";
  if (r.bookingFor === "self") return "self";
  if (r.isProxyBooking === true) return "relative";
  if (r.notes && (r.notes.includes("[Đặt lịch hộ") || r.notes.includes("[Đặt cho người thân]"))) {
    return "relative";
  }
  if (r.patientNotes) {
    try {
      const parsed = JSON.parse(r.patientNotes);
      if (parsed?.bookingFor === "relative") return "relative";
      if (parsed?.bookingFor === "self") return "self";
      if (parsed?.isProxyBooking === true) return "relative";
      if (parsed?.text && (parsed.text.includes("[Đặt lịch hộ") || parsed.text.includes("[Đặt cho người thân]"))) {
        return "relative";
      }
    } catch {
      if (String(r.patientNotes).includes("[Đặt lịch hộ") || String(r.patientNotes).includes("[Đặt cho người thân]")) {
        return "relative";
      }
    }
  }
  return "self";
}

function stripVietnameseAccents(str: string): string {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

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
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 0;

    let queryBuilder = db
      .select({
        id: appointments.id,
        tenantId: appointments.tenantId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        source: appointments.source,
        notes: appointments.notes,
        cancelReason: (appointments as any).cancelReason,
        bookingFor: (appointments as any).bookingFor,
        isProxyBooking: (appointments as any).isProxyBooking,
        bookedForName: (appointments as any).bookedForName,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientNotes: patients.notes,
        debt: patients.debt,
        allergies: patients.allergies,
        lastXRayDate: patients.lastXRayDate,
        providerId: providers.id,
        providerName: providers.name,
        serviceId: services.id,
        serviceName: services.name,
        servicePrice: services.price,
        customServiceName: appointments.customServiceName,
        serviceIds: appointments.serviceIds,
        durationMins: services.durationMins,
        rating: appointments.rating,
        reviewComment: appointments.reviewComment,
        reviewTags: appointments.reviewTags,
        reviewedAt: appointments.reviewedAt,
        isReviewHidden: appointments.isReviewHidden,
        isRatingHidden: appointments.isRatingHidden,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(appointments.startAt);

    const requestTenantId = getRequestTenantId(req);
    const includeAllTenants = req.query.scope === "all" && !requestTenantId;
    const matchesCurrentTenant = (r: any) => {
      if (includeAllTenants) return true;
      return normalizeTenant(r.tenantId) === requestTenantId;
    };

    const mapRow = (r: any) => {
      const mode = resolveMode(r);
      return {
        ...r,
        tenantId: normalizeTenant(r.tenantId),
        bookingFor: mode,
        isProxyBooking: mode === "relative",
        bookedForName: r.bookedForName || r.patientName,
        notes: cleanSystemNotes(r.notes),
        serviceName: r.customServiceName || r.serviceName,
      };
    };

    const allRawResults = (await queryBuilder).filter(matchesCurrentTenant);

    if (limit > 0) {
      const offset = (page - 1) * limit;
      const results = allRawResults.slice(offset, offset + limit).map(mapRow);
      const total = allRawResults.length;
      
      return res.json({ 
        success: true, 
        data: results,
        pagination: {
           total,
           page,
           limit,
           totalPages: Math.ceil(total / limit)
        }
      });
    } else {
      const results = allRawResults.map(mapRow);
      res.json({
        success: true,
        data: results,
      });
    }
  } catch (error) {
    next(error);
  }
});

// [M14] Lịch sử cuộc hẹn (Hoàn thành & Đã hủy / Không đến) theo thời gian & từng khách hàng
appointmentRouter.get("/history", requirePermission("appointment.view"), async (req, res, next) => {
  try {
    const startDate = typeof req.query.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate)
      ? req.query.startDate
      : undefined;
    const endDate = typeof req.query.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)
      ? req.query.endDate
      : undefined;
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "ALL";
    const patientIdFilter = typeof req.query.patientId === "string" ? req.query.patientId.trim() : "";
    const customerPhoneFilter = typeof req.query.customerPhone === "string" ? req.query.customerPhone.replace(/\D/g, "") : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const sortDir = req.query.sort === "asc" ? "asc" : "desc";
    const includeCustomers = req.query.includeCustomers !== "false";

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limitParam = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : 25;
    const limit = isNaN(limitParam) ? 25 : Math.max(0, limitParam);

    const conditions = [];
    if (startDate) {
      conditions.push(gte(appointments.startAt, startOfDay(parseISO(startDate))));
    }
    if (endDate) {
      conditions.push(lte(appointments.startAt, endOfDay(parseISO(endDate))));
    }
    if (patientIdFilter) {
      conditions.push(eq(appointments.patientId, patientIdFilter));
    }

    const rawRows = await db
      .select({
        id: appointments.id,
        tenantId: appointments.tenantId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        source: appointments.source,
        notes: appointments.notes,
        cancelReason: (appointments as any).cancelReason,
        bookingFor: (appointments as any).bookingFor,
        isProxyBooking: (appointments as any).isProxyBooking,
        bookedForName: (appointments as any).bookedForName,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientNotes: patients.notes,
        providerId: providers.id,
        providerName: providers.name,
        serviceId: services.id,
        serviceName: services.name,
        servicePrice: services.price,
        customServiceName: appointments.customServiceName,
        serviceIds: appointments.serviceIds,
        durationMins: services.durationMins,
        rating: appointments.rating,
        reviewComment: appointments.reviewComment,
        reviewTags: appointments.reviewTags,
        reviewedAt: appointments.reviewedAt,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const requestTenantId = getRequestTenantId(req);
    const includeAllTenants = req.query.scope === "all" && !requestTenantId;

    // Build service price lookup map so multi-service appointments sum exact price
    const allClinicServices = await db.select().from(services);
    const servicePriceMap = new Map<string, number>();
    for (const s of allClinicServices as any[]) {
      if (s?.id) {
        servicePriceMap.set(s.id, Number(s.price) || 0);
      }
      if (s?.originalId && !servicePriceMap.has(s.originalId)) {
        servicePriceMap.set(s.originalId, Number(s.price) || 0);
      }
    }

    const searchNormalized = stripVietnameseAccents(search);
    const searchDigits = search.replace(/\D/g, "");

    let filteredRows = rawRows
      .filter((r: any) => {
        if (!includeAllTenants && normalizeTenant(r.tenantId) !== requestTenantId) {
          return false;
        }
        const status = String(r.status || "").toUpperCase();
        if (!HISTORY_STATUS_SET.has(status)) {
          return false;
        }
        if (statusFilter === "COMPLETED") {
          if (status !== "COMPLETED") return false;
        } else if (statusFilter === "CANCELLED") {
          if (!CANCELLED_STATUS_SET.has(status)) return false;
        } else if (statusFilter !== "ALL" && status !== statusFilter) {
          return false;
        }
        if (customerPhoneFilter) {
          const phoneDigits = String(r.patientPhone || "").replace(/\D/g, "");
          const tailTarget = customerPhoneFilter.length >= 9 ? customerPhoneFilter.slice(-9) : customerPhoneFilter;
          if (!phoneDigits.includes(tailTarget)) return false;
        }
        return true;
      })
      .map((r: any) => {
        const mode = resolveMode(r);
        let calculatedPrice = Number(r.servicePrice) || 0;
        if (Array.isArray(r.serviceIds) && r.serviceIds.length > 0) {
          const multiSum = r.serviceIds.reduce((sum: number, sId: string) => {
            return sum + (servicePriceMap.get(sId) || 0);
          }, 0);
          if (multiSum > 0 || r.serviceIds.some((sId: string) => servicePriceMap.has(sId))) {
            calculatedPrice = multiSum;
          }
        }
        return {
          id: r.id,
          tenantId: normalizeTenant(r.tenantId),
          startAt: r.startAt,
          endAt: r.endAt,
          status: r.status,
          source: r.source,
          notes: cleanSystemNotes(r.notes),
          cancelReason: r.cancelReason ? String(r.cancelReason).trim() : "",
          bookingFor: mode,
          isProxyBooking: mode === "relative",
          bookedForName: r.bookedForName || r.patientName || "Khách hàng",
          patientId: r.patientId || "",
          patientName: r.patientName || "Khách vãng lai",
          patientPhone: r.patientPhone || "",
          providerId: r.providerId || "",
          providerName: r.providerName || "",
          serviceId: r.serviceId || "",
          serviceName: r.customServiceName || r.serviceName || "Khám nha khoa",
          serviceIds: r.serviceIds || [],
          servicePrice: calculatedPrice,
          durationMins: Number(r.durationMins) || 30,
          rating: r.rating ?? null,
          reviewComment: r.reviewComment || "",
          reviewTags: Array.isArray(r.reviewTags) ? r.reviewTags : [],
          reviewedAt: r.reviewedAt || null,
          createdAt: r.createdAt || null,
          updatedAt: r.updatedAt || null,
        };
      });

    if (searchNormalized) {
      filteredRows = filteredRows.filter((item: any) => {
        const haystack = stripVietnameseAccents(
          [
            item.patientName,
            item.bookedForName,
            item.patientPhone,
            item.serviceName,
            item.providerName,
            item.cancelReason,
            item.notes,
            item.id,
          ].join(" ")
        );
        if (haystack.includes(searchNormalized)) return true;
        if (searchDigits.length >= 3) {
          const phoneDigits = String(item.patientPhone || "").replace(/\D/g, "");
          if (phoneDigits.includes(searchDigits)) return true;
        }
        return false;
      });
    }

    // Sort chronologically
    filteredRows.sort((a: any, b: any) => {
      const tA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tB = b.startAt ? new Date(b.startAt).getTime() : 0;
      if (tA !== tB) return sortDir === "asc" ? tA - tB : tB - tA;
      const uA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const uB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return sortDir === "asc" ? uA - uB : uB - uA;
    });

    // Compute Summary & Per-Customer Groups
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let totalCompletedRevenue = 0;

    const customerMap = new Map<
      string,
      {
        customerKey: string;
        patientId: string;
        patientName: string;
        patientPhone: string;
        totalTransactions: number;
        completedCount: number;
        cancelledCount: number;
        noShowCount: number;
        totalCompletedRevenue: number;
        latestAt: string;
        earliestAt: string;
        appointments: any[];
      }
    >();

    for (const item of filteredRows) {
      const st = String(item.status || "").toUpperCase();
      if (st === "COMPLETED") {
        completedCount++;
        totalCompletedRevenue += Number(item.servicePrice) || 0;
      } else if (st === "NO_SHOW") {
        noShowCount++;
        cancelledCount++;
      } else if (CANCELLED_STATUS_SET.has(st)) {
        cancelledCount++;
      }

      const cleanDigits = String(item.patientPhone || "").replace(/\D/g, "");
      const customerKey = item.patientId
        ? `pid:${item.patientId}`
        : cleanDigits
        ? `phone:${cleanDigits.slice(-9)}`
        : `name:${stripVietnameseAccents(item.patientName)}`;

      let group = customerMap.get(customerKey);
      const itemTimeIso = item.startAt ? new Date(item.startAt).toISOString() : new Date().toISOString();
      if (!group) {
        group = {
          customerKey,
          patientId: item.patientId || "",
          patientName: item.patientName,
          patientPhone: item.patientPhone,
          totalTransactions: 0,
          completedCount: 0,
          cancelledCount: 0,
          noShowCount: 0,
          totalCompletedRevenue: 0,
          latestAt: itemTimeIso,
          earliestAt: itemTimeIso,
          appointments: [],
        };
        customerMap.set(customerKey, group);
      }

      group.totalTransactions += 1;
      if (st === "COMPLETED") {
        group.completedCount += 1;
        group.totalCompletedRevenue += Number(item.servicePrice) || 0;
      } else if (st === "NO_SHOW") {
        group.noShowCount += 1;
        group.cancelledCount += 1;
      } else if (CANCELLED_STATUS_SET.has(st)) {
        group.cancelledCount += 1;
      }
      if (new Date(itemTimeIso).getTime() > new Date(group.latestAt).getTime()) {
        group.latestAt = itemTimeIso;
      }
      if (new Date(itemTimeIso).getTime() < new Date(group.earliestAt).getTime()) {
        group.earliestAt = itemTimeIso;
      }
      group.appointments.push(item);
    }

    const totalTransactions = filteredRows.length;
    const completionRate = totalTransactions > 0 ? Math.round((completedCount / totalTransactions) * 100) : 0;

    const customerGroups = includeCustomers
      ? Array.from(customerMap.values()).sort((a, b) => {
          const tA = new Date(a.latestAt).getTime();
          const tB = new Date(b.latestAt).getTime();
          return sortDir === "asc" ? tA - tB : tB - tA;
        })
      : undefined;

    const total = filteredRows.length;
    const paginatedData = limit > 0 ? filteredRows.slice((page - 1) * limit, (page - 1) * limit + limit) : filteredRows;

    res.json({
      success: true,
      summary: {
        totalTransactions,
        completedCount,
        cancelledCount,
        noShowCount,
        completionRate,
        totalCompletedRevenue,
        uniqueCustomersCount: customerMap.size,
      },
      data: paginatedData,
      ...(includeCustomers ? { customerGroups } : {}),
      pagination: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
      },
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

    const requestTenantId = getRequestTenantId(req);

    const results = (await db
      .select({
        id: appointments.id,
        tenantId: appointments.tenantId,
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
      .orderBy(desc(appointments.startAt)))
      .filter((r: any) => normalizeTenant(r.tenantId) === requestTenantId)
      .slice(0, 10);

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
    const requestTenantId = getRequestTenantId(req);

    const results = await db
      .select({
        id: appointments.id,
        tenantId: appointments.tenantId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        cancelReason: (appointments as any).cancelReason,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        debt: patients.debt,
        allergies: patients.allergies,
        providerName: providers.name,
        serviceName: services.name,
        customServiceName: appointments.customServiceName,
        serviceIds: appointments.serviceIds,
        price: services.price,
        durationMins: services.durationMins,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, id))
      .limit(1);

    if (results.length === 0 || normalizeTenant(results[0].tenantId) !== requestTenantId) {
      return res.status(404).json({ success: false, error: { message: "Không tìm thấy lịch hẹn" } });
    }

    const row = results[0];
    res.json({ 
      success: true, 
      data: {
        ...row,
        serviceName: row.customServiceName || row.serviceName
      } 
    });
  } catch (error) {
    next(error);
  }
});

// [M02] Đặt lịch trực tiếp (Admin/Receptionist)
appointmentRouter.post("/next", requirePermission("appointment.create"), async (req, res, next) => {
  try {
    let { patientId, providerId, serviceId, serviceIds, customServiceName, startAt, endAt, notes } = req.body;
    const targetServiceIds = Array.isArray(serviceIds) && serviceIds.length > 0 
      ? serviceIds 
      : (serviceId ? [serviceId] : []);

    if (!patientId || targetServiceIds.length === 0 || !startAt || !endAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc");
    }

    const primaryServiceId = targetServiceIds[0];

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

    let combinedCustomName = customServiceName;
    if (!combinedCustomName && targetServiceIds.length > 1) {
      const allSvc = await db.select().from(services);
      const matched = allSvc.filter((s: any) => targetServiceIds.includes(s.id));
      if (matched.length > 0) {
        combinedCustomName = matched.map((s: any) => s.name).join(' + ');
      }
    }

    const newAppointment = await db.insert(appointments).values({
      patientId,
      providerId,
      serviceId: primaryServiceId,
      serviceIds: targetServiceIds,
      customServiceName: combinedCustomName || undefined,
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
      serviceIds: reqServiceIds,
      customServiceName: reqCustomServiceName,
      providerId: reqProviderId, 
      startAt, 
      endAt: reqEndAt, 
      notes, 
      status: reqStatus, 
      force,
      patientId: reqPatientId
    } = req.body;

    const targetServiceIds: string[] = Array.isArray(reqServiceIds) && reqServiceIds.length > 0
      ? reqServiceIds
      : (serviceId ? [serviceId] : []);

    if (!patientName || !phone || targetServiceIds.length === 0 || !startAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc (Họ tên, Số điện thoại, Dịch vụ, Thời gian bắt đầu)");
    }

    const primaryServiceId = targetServiceIds[0];

    const bookingResult = await db.transaction(async (tx) => {
      let patientId = reqPatientId;

      if (!patientId) {
        const cleanPhone = phone.replace(/\D/g, '');
        let patientRecords = await tx.select().from(patients).where(eq(patients.phone, cleanPhone));
        
        const incomingName = patientName.trim().toLowerCase().replace(/\s+/g, ' ');
        let existingPatient = null;
        for (const p of patientRecords) {
           if (p.fullName && p.fullName.trim().toLowerCase().replace(/\s+/g, ' ') === incomingName) {
              existingPatient = p;
              break;
           }
        }

        if (existingPatient) {
           patientId = existingPatient.id;
        } else {
          const notesVal = patientRecords.length > 0
            ? JSON.stringify({
                text: '',
                diagnosis: '',
                treatmentPlan: '',
                documents: [],
                bookingFor: 'self',
                isProxyBooking: false,
                primaryContactPhone: cleanPhone
              })
            : undefined;
          const newPatient = await tx.insert(patients).values({
            fullName: patientName.trim(),
            phone: cleanPhone,
            notes: notesVal
          }).returning();
          patientId = newPatient[0].id;
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

      // Determine combined duration and service names
      let allSelectedServices: any[] = [];
      for (const sId of targetServiceIds) {
        const sRec = await tx.select().from(services).where(eq(services.id, sId)).limit(1);
        if (sRec.length > 0) allSelectedServices.push(sRec[0]);
      }

      const totalDurationMins = allSelectedServices.length > 0
        ? allSelectedServices.reduce((sum, s) => sum + (s.durationMins || 30), 0)
        : 30;

      const combinedCustomName = reqCustomServiceName || (
        targetServiceIds.length > 1 && allSelectedServices.length > 0
          ? allSelectedServices.map(s => s.name).join(' + ')
          : undefined
      );

      // Determine endAt if not provided
      let finalEndAt = reqEndAt ? new Date(reqEndAt) : null;
      if (!finalEndAt || isNaN(finalEndAt.getTime())) {
        finalEndAt = new Date(new Date(startAt).getTime() + totalDurationMins * 60000);
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
        serviceId: primaryServiceId,
        serviceIds: targetServiceIds,
        customServiceName: combinedCustomName,
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
    const requestTenantId = getRequestTenantId(req);

    const oldApt = await db.select().from(appointments).where(eq(appointments.id, req.params.id)).limit(1);
    if (oldApt.length === 0 || normalizeTenant(oldApt[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }
    
    const updated = await db.update(appointments)
      .set({ 
        startAt: new Date(startAt), 
        endAt: new Date(endAt),
        updatedAt: new Date()
      })
      .where(eq(appointments.id, req.params.id))
      .returning();
    
    if (updated.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");

    // Trigger push notification to patient about rescheduled time
    sendAppointmentStatusPush(req.params.id, "RESCHEDULED", { newStartAt: startAt }).catch(console.error);

    realtimeNotification.emitBookingUpdated({
      id: updated[0].id,
      status: updated[0].status,
      startAt: updated[0].startAt,
      tenantId: normalizeTenant(updated[0].tenantId),
    });

    // Trigger waitlist since the old slot is now freed up
    triggerWaitlistMatching(oldApt[0]).catch(console.error);

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
    const requestTenantId = getRequestTenantId(req);

    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const currentStatus = existing[0].status;

    // Bỏ qua nếu trạng thái không thay đổi và không có dữ liệu đánh giá / lý do hủy
    if (currentStatus === nextStatus && req.body.rating === undefined && !cancelReason) {
      return res.json({ success: true, data: existing[0] });
    }

    // Validate State Machine nếu có thay đổi trạng thái
    if (currentStatus !== nextStatus && !isValidTransition(currentStatus, nextStatus)) {
      throw new BadRequestError(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`);
    }

    const updateData: any = { status: nextStatus, updatedAt: new Date() };
    if (cancelReason && (nextStatus === "CANCEL_CLINIC" || nextStatus === "CANCEL_PATIENT" || nextStatus === "NO_SHOW")) {
      updateData.cancelReason = String(cancelReason).trim();
    }
    if (req.body.rating !== undefined) {
      updateData.rating = Math.min(5, Math.max(1, Number(req.body.rating)));
      updateData.reviewComment = req.body.reviewComment ? String(req.body.reviewComment).trim() : "";
      updateData.reviewTags = Array.isArray(req.body.reviewTags) ? req.body.reviewTags : [];
      updateData.reviewedAt = new Date();
    }
    const updated = await db.update(appointments)
      .set(updateData)
      .where(eq(appointments.id, appointmentId))
      .returning();

    const appointment = updated[0];

    realtimeNotification.emitBookingUpdated({
      id: appointment.id,
      status: appointment.status,
      tenantId: normalizeTenant(appointment.tenantId),
    });

    // Notification Engine, Web Push (VAPID), Waitlist & Recall Triggers
    sendAppointmentStatusPush(appointment.id, nextStatus, { cancelReason }).catch(console.error);

    if (nextStatus === "CONFIRMED") {
      notifyPatientAppointment(appointment.id, "CONFIRMED").catch(console.error);
    } else if (nextStatus === "COMPLETED") {
      generateRecall(appointment).catch(console.error);
    } else if (nextStatus === "CANCEL_CLINIC" || nextStatus === "CANCEL_PATIENT") {
      notifyPatientAppointment(appointment.id, "CANCELLED", cancelReason).catch(console.error);
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

// Cập nhật hoặc lưu đánh giá của bệnh nhân cho lịch hẹn
appointmentRouter.post("/:id/review", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);
    const { rating, reviewComment, reviewTags } = req.body;

    if (rating === undefined || rating === null) {
      throw new BadRequestError("Vui lòng chọn số sao đánh giá (1-5 sao)");
    }

    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const numericRating = Math.min(5, Math.max(1, Number(rating)));
    const updated = await db.update(appointments)
      .set({
        rating: numericRating,
        reviewComment: reviewComment ? String(reviewComment).trim() : "",
        reviewTags: Array.isArray(reviewTags) ? reviewTags : [],
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    res.json({
      success: true,
      data: updated[0],
      message: "Lưu đánh giá thành công"
    });
  } catch (error) {
    next(error);
  }
});

// [M-Review] Ẩn hoặc Hiện đánh giá của bệnh nhân khỏi trang công khai
appointmentRouter.patch("/:id/review/toggle-visibility", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);
    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const currentHidden = existing[0].isReviewHidden === true;
    const nextHidden = req.body.isReviewHidden !== undefined ? Boolean(req.body.isReviewHidden) : !currentHidden;

    const updatePayload: any = {
      isReviewHidden: nextHidden,
      updatedAt: new Date()
    };

    if (req.body.isRatingHidden !== undefined) {
      updatePayload.isRatingHidden = Boolean(req.body.isRatingHidden);
    }

    const updated = await db.update(appointments)
      .set(updatePayload)
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      data: updated[0],
      isReviewHidden: nextHidden,
      isRatingHidden: updated[0].isRatingHidden === true,
      message: nextHidden ? "Đã ẩn đánh giá khỏi trang công khai" : "Đã bật hiển thị đánh giá công khai"
    });
  } catch (error) {
    next(error);
  }
});

// [M-Review] Ẩn hoặc Hiện điểm sao đánh giá của đợt điều trị
appointmentRouter.patch("/:id/review/toggle-rating-visibility", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);
    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const currentRatingHidden = existing[0].isRatingHidden === true;
    const nextRatingHidden = req.body.isRatingHidden !== undefined ? Boolean(req.body.isRatingHidden) : !currentRatingHidden;

    const updated = await db.update(appointments)
      .set({
        isRatingHidden: nextRatingHidden,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      data: updated[0],
      isRatingHidden: nextRatingHidden,
      message: nextRatingHidden ? "Đã ẩn điểm sao đánh giá của đợt điều trị" : "Đã bật hiển thị điểm sao đánh giá của đợt điều trị"
    });
  } catch (error) {
    next(error);
  }
});

// [M-Review] Xóa vĩnh viễn đánh giá của bệnh nhân
appointmentRouter.delete("/:id/review", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);
    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const updated = await db.update(appointments)
      .set({
        rating: null,
        reviewComment: null,
        reviewTags: [],
        reviewedAt: null,
        isReviewHidden: false,
        isRatingHidden: false,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      data: updated[0],
      message: "Đã xóa đánh giá thành công"
    });
  } catch (error) {
    next(error);
  }
});

// [M02] Gửi thông báo Telegram / Email thủ công cho bệnh nhân
appointmentRouter.post("/:id/notify-patient", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);
    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

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
    const requestTenantId = getRequestTenantId(req);
    const results = await db
      .select({
        tenantId: appointments.tenantId,
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

    if (results.length === 0 || normalizeTenant(results[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const apt = results[0];
    if (!apt.telegramId) {
      return res.status(400).json({ 
        success: false, 
        error: { message: "Khách hàng chưa được cấu hình Telegram ID. Vui lòng cập nhật ID của khách hàng để nhận tin nhắn qua bot." } 
      });
    }

    let clinicProfile = null;
    try {
      const dbSettings = await db.select().from(settings).where(eq(settings.id, "clinicProfile"));
      const matchedSetting = dbSettings.find((s: any) => normalizeTenant(s.tenantId) === requestTenantId) || dbSettings[0];
      if (matchedSetting) clinicProfile = matchedSetting.value;
    } catch {}

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
    const requestTenantId = getRequestTenantId(req);

    const existing = await db.select().from(appointments).where(eq(appointments.id, req.params.id)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }
    
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

    realtimeNotification.emitBookingUpdated({
      id: updated[0].id,
      status: updated[0].status,
      startAt: updated[0].startAt,
      tenantId: normalizeTenant(updated[0].tenantId),
    });

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

// [M02] Xóa Lịch hẹn (Admin - Cascade an toàn)
appointmentRouter.delete("/:id", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const requestTenantId = getRequestTenantId(req);

    const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (existing.length === 0 || normalizeTenant(existing[0].tenantId) !== requestTenantId) {
      throw new NotFoundError("Không tìm thấy lịch hẹn");
    }

    const { appointmentHolds, patientRecalls, auditLogs } = await import("../../db/schema.js");
    
    await db.delete(appointmentHolds).where(eq(appointmentHolds.appointmentId, appointmentId));
    await db.delete(patientRecalls).where(eq(patientRecalls.appointmentId, appointmentId));
    await db.delete(auditLogs).where(eq(auditLogs.appointmentId, appointmentId));

    await db.delete(appointments).where(eq(appointments.id, appointmentId));

    realtimeNotification.emitBookingUpdated({
      id: appointmentId,
      status: "DELETED",
      tenantId: normalizeTenant(existing[0].tenantId),
    });

    res.json({ success: true, message: "Đã xóa lịch hẹn an toàn" });
  } catch (error) {
    next(error);
  }
});

export default appointmentRouter;

