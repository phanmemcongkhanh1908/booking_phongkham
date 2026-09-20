import { Router } from "express";
import { db } from "../../db/index.js";
import { services, providers, settings, appointments, patients, users } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { BadRequestError } from "../../core/errors.js";

const adminRouter = Router();

adminRouter.use(requireAuth);

// SERVICES CRUD
adminRouter.get("/services", async (req, res, next) => {
  try {
    const allServices = await db.select().from(services).orderBy(services.name);
    res.json({ success: true, data: allServices });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/services", requirePermission("service.manage"), async (req, res, next) => {
  try {
    const durationMins = parseInt(req.body.durationMins);
    const price = req.body.price ? parseInt(req.body.price.toString().replace(/\D/g, '')) : null;
    
    if (isNaN(durationMins) || durationMins <= 0) throw new BadRequestError("Thời lượng khám không hợp lệ");
    if (price !== null && price < 0) throw new BadRequestError("Giá tiền không hợp lệ");

    const newService = await db.insert(services).values({
      name: req.body.name,
      description: req.body.description,
      durationMins,
      bufferBefore: parseInt(req.body.bufferBefore) || 0,
      bufferAfter: parseInt(req.body.bufferAfter) || 0,
      price,
      showPrice: Boolean(req.body.showPrice),
      isHot: Boolean(req.body.isHot),
      isFree: Boolean(req.body.isFree),
      isActive: true,
    }).returning();
    res.json({ success: true, data: newService[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/services/:id", requirePermission("service.manage"), async (req, res, next) => {
  try {
    const durationMins = parseInt(req.body.durationMins);
    const price = req.body.price ? parseInt(req.body.price.toString().replace(/\D/g, '')) : null;
    
    if (isNaN(durationMins) || durationMins <= 0) throw new BadRequestError("Thời lượng khám không hợp lệ");
    if (price !== null && price < 0) throw new BadRequestError("Giá tiền không hợp lệ");

    const updated = await db.update(services).set({
      name: req.body.name,
      description: req.body.description,
      durationMins,
      bufferBefore: parseInt(req.body.bufferBefore) || 0,
      bufferAfter: parseInt(req.body.bufferAfter) || 0,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      price,
      showPrice: Boolean(req.body.showPrice),
      isHot: Boolean(req.body.isHot),
      isFree: Boolean(req.body.isFree),
    }).where(eq(services.id, req.params.id)).returning();
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/services/:id", requirePermission("service.manage"), async (req, res, next) => {
  try {
    await db.delete(services).where(eq(services.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PROVIDERS CRUD
adminRouter.get("/providers", async (req, res, next) => {
  try {
    const allProviders = await db.select().from(providers).orderBy(providers.name);
    res.json({ success: true, data: allProviders });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/providers", requirePermission("provider.manage"), async (req, res, next) => {
  try {
    // If this provider is marked as default, unset others first (simulated in memory via update loop if needed, but here we just update all)
    if (req.body.isDefault) {
       const allProviders = await db.select().from(providers);
       for (const p of allProviders) {
         if (p.isDefault) {
           await db.update(providers).set({ isDefault: false }).where(eq(providers.id, p.id));
         }
       }
    }

    const newProvider = await db.insert(providers).values({
      name: req.body.name,
      specialty: req.body.specialty,
      experience: req.body.experience,
      specialties: req.body.specialties,
      certificates: req.body.certificates,
      workingHours: req.body.workingHours || {},
      bookingEnabled: req.body.bookingEnabled !== false,
      isActive: req.body.isActive !== false,
      isDefault: Boolean(req.body.isDefault),
    }).returning();
    res.json({ success: true, data: newProvider[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/providers/:id", requirePermission("provider.manage"), async (req, res, next) => {
console.log("PUT /providers/:id called. req.user=", req.user);
  try {
    if (req.body.isDefault) {
       const allProviders = await db.select().from(providers);
       for (const p of allProviders) {
         if (p.isDefault && p.id !== req.params.id) {
           await db.update(providers).set({ isDefault: false }).where(eq(providers.id, p.id));
         }
       }
    }

    const updated = await db.update(providers).set({
      name: req.body.name,
      specialty: req.body.specialty,
      experience: req.body.experience,
      specialties: req.body.specialties,
      certificates: req.body.certificates,
      workingHours: req.body.workingHours || {},
      bookingEnabled: req.body.bookingEnabled !== false,
      isActive: req.body.isActive !== false,
      isDefault: Boolean(req.body.isDefault),
    }).where(eq(providers.id, req.params.id)).returning();
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/providers/:id", requirePermission("provider.manage"), async (req, res, next) => {
  try {
    await db.delete(providers).where(eq(providers.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// CONFIG (Working Hours & Interval)
adminRouter.get("/config", async (req, res, next) => {
  try {
    const allProviders = await db.select().from(providers).where(eq(providers.isActive, true));
    const defaultProvider = allProviders.find((p: any) => p.isDefault) || allProviders[0];
    const workingHours = defaultProvider ? defaultProvider.workingHours : {};
    
    // Fallback settings if settings table is not available
    let intervalStep = 30;
    try {
      const dbSettings = await db.select().from(settings).where(eq(settings.id, "global")).limit(1);
      if (dbSettings.length > 0) {
        intervalStep = (dbSettings[0].value as any).intervalStep || 30;
      }
    } catch (e) {
      // ignore
    }

    res.json({ success: true, data: { workingHours, intervalStep } });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/config", async (req, res, next) => {
  try {
    const { workingHours, intervalStep } = req.body;
    const allProviders = await db.select().from(providers).where(eq(providers.isActive, true));
    const defaultProvider = allProviders.find((p: any) => p.isDefault) || allProviders[0];
    
    if (defaultProvider) {
      await db.update(providers)
        .set({ workingHours })
        .where(eq(providers.id, defaultProvider.id));
    }

    try {
      // Upsert settings
      const existing = await db.select().from(settings).where(eq(settings.id, "global")).limit(1);
      if (existing.length > 0) {
        await db.update(settings).set({ value: { intervalStep: parseInt(intervalStep) || 30 } }).where(eq(settings.id, "global"));
      } else {
        await db.insert(settings).values({ id: "global", value: { intervalStep: parseInt(intervalStep) || 30 } });
      }
    } catch (e) {
      // ignore if settings table fails
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});


// Backup & Restore
adminRouter.get("/backup", requireAuth, requirePermission("*"), async (req, res, next) => {
  try {
    const { patients, providers, services, appointments, settings } = await import("../../db/schema.js");
    const pts = await db.select().from(patients);
    const prvs = await db.select().from(providers);
    const srvs = await db.select().from(services);
    const apts = await db.select().from(appointments);
    const sets = await db.select().from(settings);
    
    res.json({
      success: true,
      data: {
        patients: pts,
        providers: prvs,
        services: srvs,
        appointments: apts,
        settings: sets,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/restore", requireAuth, async (req, res, next) => {
  try {
    const backupData = req.body.data;
    if (!backupData) return res.status(400).json({ success: false, error: { message: "No data provided" }});
    
    // In a real prod app, use transactions and insert in order of foreign keys
    // For this prototype, we'll just insert what we can
    const { patients, providers, services, appointments, settings } = await import("../../db/schema.js");
    
    if (backupData.patients && backupData.patients.length > 0) {
      await db.insert(patients).values(backupData.patients).onConflictDoNothing();
    }
    if (backupData.providers && backupData.providers.length > 0) {
      await db.insert(providers).values(backupData.providers).onConflictDoNothing();
    }
    if (backupData.services && backupData.services.length > 0) {
      await db.insert(services).values(backupData.services).onConflictDoNothing();
    }
    if (backupData.appointments && backupData.appointments.length > 0) {
      // Re-parse dates
      const parsedApts = backupData.appointments.map((a: any) => ({
        ...a,
        startAt: new Date(a.startAt),
        endAt: new Date(a.endAt),
        createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
        updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
      }));
      await db.insert(appointments).values(parsedApts).onConflictDoNothing();
    }
    if (backupData.settings && backupData.settings.length > 0) {
      await db.insert(settings).values(backupData.settings).onConflictDoNothing();
    }

    res.json({ success: true, message: "Restored successfully" });
  } catch (error) {
    next(error);
  }
});


adminRouter.post("/wipe", requireAuth, async (req, res, next) => {
  try {
    const { wipeClinicData } = await import("../../core/wipe.js");
    const result = await wipeClinicData();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

import { sql } from "drizzle-orm";

// ... (adminRouter already has imports, we just need to add routes)

// Lấy dữ liệu thống kê phân tích chuyên sâu
adminRouter.get("/analytics", requireAuth, async (req, res, next) => {
  try {
    const range = String(req.query.range || "all"); // 7, 14, 30, 90, all
    const allAppointments = await db.select().from(appointments);
    const allServices = await db.select().from(services);
    
    const serviceMap: any = {};
    allServices.forEach((s: any) => {
      serviceMap[s.id] = s;
    });

    const serviceStatsMap: Record<string, { id: string; name: string; count: number; revenue: number; durationMins: number }> = {};
    const dailyStatsMap: Record<string, { date: string; completed: number; cancelled: number; pending: number; total: number; revenue: number }> = {};
    const appointmentsByDay: Record<string, number> = {};
    const appointmentsByWeek: Record<string, number> = {};
    const patientVisits: Record<string, number> = {};

    let totalRevenue = 0;
    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let pendingAppointments = 0;
    let confirmedAppointments = 0;

    const statusCounts: Record<string, number> = {
      COMPLETED: 0,
      CONFIRMED: 0,
      PENDING: 0,
      IN_PROGRESS: 0,
      CANCEL_PATIENT: 0,
      CANCEL_CLINIC: 0,
      NO_SHOW: 0,
    };

    const todayStr = new Date().toISOString().split("T")[0];
    let todayAppointments = 0;
    let todayRevenue = 0;

    allAppointments.forEach((a: any) => {
      const status = a.status || "PENDING";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const price = Number(serviceMap[a.serviceId]?.price || 0);

      if (status === "COMPLETED") {
        completedAppointments += 1;
        totalRevenue += price;
      } else if (status === "CANCEL_PATIENT" || status === "CANCEL_CLINIC" || status === "NO_SHOW") {
        cancelledAppointments += 1;
      } else if (status === "CONFIRMED") {
        confirmedAppointments += 1;
      } else {
        pendingAppointments += 1;
      }

      // Dịch vụ mũi nhọn
      if (a.serviceId) {
        if (!serviceStatsMap[a.serviceId]) {
          serviceStatsMap[a.serviceId] = {
            id: a.serviceId,
            name: serviceMap[a.serviceId]?.name || "Khác",
            count: 0,
            revenue: 0,
            durationMins: Number(serviceMap[a.serviceId]?.durationMins || 30),
          };
        }
        serviceStatsMap[a.serviceId].count += 1;
        if (status === "COMPLETED") {
          serviceStatsMap[a.serviceId].revenue += price;
        }
      }

      // Thống kê theo ngày
      if (a.startAt) {
        const date = new Date(a.startAt);
        const dateStr = date.toISOString().split("T")[0];

        if (!dailyStatsMap[dateStr]) {
          dailyStatsMap[dateStr] = { date: dateStr, completed: 0, cancelled: 0, pending: 0, total: 0, revenue: 0 };
        }
        dailyStatsMap[dateStr].total += 1;
        if (status === "COMPLETED") {
          dailyStatsMap[dateStr].completed += 1;
          dailyStatsMap[dateStr].revenue += price;
        } else if (status === "CANCEL_PATIENT" || status === "CANCEL_CLINIC" || status === "NO_SHOW") {
          dailyStatsMap[dateStr].cancelled += 1;
        } else {
          dailyStatsMap[dateStr].pending += 1;
        }

        if (dateStr === todayStr) {
          todayAppointments += 1;
          if (status === "COMPLETED") todayRevenue += price;
        }

        appointmentsByDay[dateStr] = (appointmentsByDay[dateStr] || 0) + 1;

        // Tuần
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        const weekStr = `${date.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
        appointmentsByWeek[weekStr] = (appointmentsByWeek[weekStr] || 0) + 1;
      }

      // Tần suất bệnh nhân
      if (a.patientId) {
        patientVisits[a.patientId] = (patientVisits[a.patientId] || 0) + 1;
      }
    });

    // Điền ngày trống nếu xem dạng range
    const daysRange = range === "7" ? 7 : range === "14" ? 14 : range === "30" ? 30 : 0;
    if (daysRange > 0) {
      const now = new Date();
      for (let i = daysRange - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        if (!dailyStatsMap[dStr]) {
          dailyStatsMap[dStr] = { date: dStr, completed: 0, cancelled: 0, pending: 0, total: 0, revenue: 0 };
        }
      }
    }

    const totalPatientsCount = Object.keys(patientVisits).length;
    const returningPatients = Object.values(patientVisits).filter((count: number) => count > 1).length;
    const returningRate = totalPatientsCount > 0 ? Math.round((returningPatients / totalPatientsCount) * 100) : 0;
    const totalAppointmentsCount = allAppointments.length;
    const completionRate = totalAppointmentsCount > 0 ? Math.round((completedAppointments / totalAppointmentsCount) * 100) : 0;
    const cancellationRate = totalAppointmentsCount > 0 ? Math.round((cancelledAppointments / totalAppointmentsCount) * 100) : 0;
    const avgTicket = completedAppointments > 0 ? Math.round(totalRevenue / completedAppointments) : 0;

    const sortedDailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));
    const sortedDays = Object.entries(appointmentsByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    const sortedWeeks = Object.entries(appointmentsByWeek)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([week, count]) => ({ week, count }));

    // Bổ sung % doanh thu từng dịch vụ
    const enrichedServices = Object.values(serviceStatsMap)
      .map(s => ({
        ...s,
        percent: totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const statusBreakdown = [
      { status: "COMPLETED", label: "Đã hoàn thành", count: statusCounts.COMPLETED, color: "#10b981" },
      { status: "CONFIRMED", label: "Đã xác nhận", count: statusCounts.CONFIRMED, color: "#3b82f6" },
      { status: "PENDING", label: "Chờ xác nhận", count: statusCounts.PENDING, color: "#f59e0b" },
      { status: "IN_PROGRESS", label: "Đang khám", count: statusCounts.IN_PROGRESS, color: "#8b5cf6" },
      { status: "CANCELLED", label: "Đã hủy / Vắng mặt", count: statusCounts.CANCEL_PATIENT + statusCounts.CANCEL_CLINIC + statusCounts.NO_SHOW, color: "#ef4444" },
    ].filter(s => s.count > 0);

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalAppointments: totalAppointmentsCount,
          completedAppointments,
          cancelledAppointments,
          pendingAppointments,
          confirmedAppointments,
          completionRate,
          cancellationRate,
          avgTicket,
          totalPatients: totalPatientsCount,
          returningPatients,
          returningRate,
          todayAppointments,
          todayRevenue,
        },
        serviceStats: enrichedServices,
        occupancyStats: sortedDailyStats,
        appointmentsByDay: sortedDays,
        appointmentsByWeek: sortedWeeks,
        statusBreakdown,
        returningRate,
        totalPatients: totalPatientsCount,
        returningPatients,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingsObj: any = {};
    allSettings.forEach(s => {
      const key = s.key || s.id;
      // Map legacy clinic_profile to clinicProfile
      if (key === 'clinic_profile' || s.id === 'clinic_profile') {
        settingsObj['clinicProfile'] = s.value;
      } else {
        settingsObj[s.id] = s.value;
        if (s.key) settingsObj[s.key] = s.value;
      }
    });
    
    // Mask sensitive data
    if (settingsObj.smtpPassword) settingsObj.smtpPassword = "••••••••";
    if (settingsObj.telegramToken) settingsObj.telegramToken = "••••••••";
    
    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
});

// Cập nhật cài đặt hệ thống
adminRouter.post("/settings", requireAuth, requirePermission("setting.manage"), async (req, res, next) => {
  try {
    const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig, bookingFormConfig, announcementBanner, idleTimeoutMinutes } = req.body;
    
    // Save to DB
    if (telegramToken !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramToken', key: 'telegramToken', value: telegramToken })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramToken } });
    }
    if (telegramChatId !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramChatId', key: 'telegramChatId', value: telegramChatId })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramChatId } });
    }
    if (telegramBotUsername !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramBotUsername', key: 'telegramBotUsername', value: telegramBotUsername })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramBotUsername } });
    }
    if (clinicProfile !== undefined) {
      await db.insert(settings)
        .values({ id: 'clinicProfile', key: 'clinicProfile', value: clinicProfile })
        .onConflictDoUpdate({ target: settings.id, set: { value: clinicProfile } });
    }
    if (emailConfig !== undefined) {
      await db.insert(settings)
        .values({ id: 'emailConfig', key: 'emailConfig', value: emailConfig })
        .onConflictDoUpdate({ target: settings.id, set: { value: emailConfig } });
    }
    if (bookingFormConfig !== undefined) {
      await db.insert(settings)
        .values({ id: 'bookingFormConfig', key: 'bookingFormConfig', value: bookingFormConfig })
        .onConflictDoUpdate({ target: settings.id, set: { value: bookingFormConfig } });
    }
    if (announcementBanner !== undefined) {
      await db.insert(settings)
        .values({ id: 'announcementBanner', key: 'announcementBanner', value: announcementBanner })
        .onConflictDoUpdate({ target: settings.id, set: { value: announcementBanner } });
    }
    if (idleTimeoutMinutes !== undefined) {
      await db.insert(settings)
        .values({ id: 'idleTimeoutMinutes', key: 'idleTimeoutMinutes', value: String(idleTimeoutMinutes) })
        .onConflictDoUpdate({ target: settings.id, set: { value: String(idleTimeoutMinutes) } });
    }

    // Trigger reload bot
    const { reloadBotConfig } = await import("../../core/telegram.js");
    await reloadBotConfig(telegramToken, telegramChatId, telegramBotUsername);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Test gửi email từ Admin Settings
adminRouter.post("/settings/test-email", requireAuth, async (req, res, next) => {
  try {
    const { emailConfig, recipientEmail } = req.body;
    const { testSmtpConnection, getEmailConfig } = await import("../../services/email.js");
    
    const configToTest = emailConfig || await getEmailConfig();
    const target = recipientEmail || configToTest.user;

    if (!target) {
      return res.status(400).json({ success: false, error: { message: "Vui lòng nhập địa chỉ email nhận thư thử nghiệm" } });
    }

    await testSmtpConnection(configToTest, target);
    res.json({ success: true, message: `Đã gửi thư kiểm tra thành công tới: ${target}` });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || "Lỗi khi kết nối tới máy chủ SMTP" } });
  }
});

// Test gửi tin nhắn Telegram từ Admin Settings
adminRouter.post("/settings/test-telegram", requireAuth, async (req, res, next) => {
  try {
    const { getTelegramBotInstance } = await import("../../core/telegram.js");
    const bot = getTelegramBotInstance();
    if (!bot) {
      return res.status(400).json({ success: false, error: { message: "Telegram Bot chưa được khởi tạo. Vui lòng kiểm tra Token." } });
    }

    const { telegramChatId } = req.body;
    const chatIdRes = await db.select().from(settings).where(eq(settings.id, "telegramChatId")).limit(1);
    const targetChatId = telegramChatId || (chatIdRes.length > 0 ? chatIdRes[0].value : null);

    if (!targetChatId) {
      return res.status(400).json({ success: false, error: { message: "Chưa cấu hình Chat ID để nhận tin nhắn kiểm tra." } });
    }

    await bot.sendMessage(targetChatId, "🔔 *[Dental Smart Booking]* Kiểm tra kết nối Telegram Bot thành công! Hệ thống sẵn sàng gửi thông báo.", {
      parse_mode: "Markdown"
    });

    res.json({ success: true, message: `Đã gửi tin nhắn Telegram kiểm tra tới Chat ID: ${targetChatId}` });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message || "Lỗi khi gửi tin nhắn Telegram" } });
  }
});


adminRouter.get("/appointments", requireAuth, async (req, res, next) => {
  try {
    const results = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        status: appointments.status,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        serviceName: services.name,
        providerName: providers.name
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .orderBy(desc(appointments.startAt));
      
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/storage-alert", requireAuth, async (req, res, next) => {
  try {
    const { usedPercent, driveLink } = req.body;
    
    const userRecord = await db.select().from(users).where(eq(users.id, req.user?.userId)).limit(1);
    const emailToUse = userRecord[0]?.email;
    
    if (emailToUse && usedPercent > 80) {
      const { sendStorageAlertEmail } = await import("../../services/email.js");
      // Get clinic name
      const settingsDb = await db.select().from(settings).where(eq(settings.id, "clinicProfile")).limit(1);
      const clinicName = settingsDb[0]?.value?.name || "Nha Khoa Smart Dental";
      
      await sendStorageAlertEmail(emailToUse, clinicName, usedPercent, driveLink);
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GOOGLE SYNC ACCOUNTS (Danh sách Gmail phòng khám được uỷ quyền)
// ==========================================
adminRouter.get("/google-sync-accounts", requireAuth, async (req, res, next) => {
  try {
    const record = await db.select().from(settings).where(eq(settings.id, "google_sync_accounts")).limit(1);
    const accounts = Array.isArray(record[0]?.value) ? record[0].value : [];
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/google-sync-accounts", requireAuth, requirePermission("setting.manage"), async (req, res, next) => {
  try {
    const { clinicName, doctorName, email, phone, notes } = req.body;
    if (!email || !email.includes("@")) {
      throw new BadRequestError("Địa chỉ Gmail không hợp lệ");
    }
    const cleanEmail = email.trim().toLowerCase();
    const record = await db.select().from(settings).where(eq(settings.id, "google_sync_accounts")).limit(1);
    let accounts: any[] = Array.isArray(record[0]?.value) ? record[0].value : [];

    const existingIndex = accounts.findIndex((a: any) => a.email.toLowerCase() === cleanEmail);
    const newAccount = {
      id: existingIndex >= 0 ? accounts[existingIndex].id : 'ga_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      clinicName: (clinicName || 'Phòng khám Nha Khoa').trim(),
      doctorName: (doctorName || '').trim(),
      email: cleanEmail,
      phone: (phone || '').trim(),
      notes: (notes || '').trim(),
      status: 'active',
      createdAt: existingIndex >= 0 ? accounts[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = { ...accounts[existingIndex], ...newAccount };
    } else {
      accounts.unshift(newAccount);
    }

    await db.insert(settings)
      .values({ id: "google_sync_accounts", value: accounts })
      .onConflictDoUpdate({ target: settings.id, set: { value: accounts } });

    res.json({ success: true, data: newAccount, all: accounts });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/google-sync-accounts/batch", requireAuth, requirePermission("setting.manage"), async (req, res, next) => {
  try {
    const { emailsText, defaultClinicName } = req.body;
    if (!emailsText) {
      throw new BadRequestError("Vui lòng cung cấp danh sách email");
    }
    const rawTokens = emailsText.split(/[\s,;\n\r]+/);
    const validEmails = Array.from(new Set(
      rawTokens
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.includes('@') && t.includes('.'))
    ));

    if (validEmails.length === 0) {
      throw new BadRequestError("Không tìm thấy email hợp lệ nào trong danh sách dán");
    }

    const record = await db.select().from(settings).where(eq(settings.id, "google_sync_accounts")).limit(1);
    let accounts: any[] = Array.isArray(record[0]?.value) ? record[0].value : [];

    let addedCount = 0;
    for (const em of validEmails) {
      const existing = accounts.find((a: any) => a.email.toLowerCase() === em);
      if (!existing) {
        accounts.unshift({
          id: 'ga_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          clinicName: defaultClinicName?.trim() || 'Phòng khám Nha khoa',
          doctorName: '',
          email: em,
          phone: '',
          notes: 'Thêm hàng loạt từ Admin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        addedCount++;
      }
    }

    await db.insert(settings)
      .values({ id: "google_sync_accounts", value: accounts })
      .onConflictDoUpdate({ target: settings.id, set: { value: accounts } });

    res.json({ success: true, addedCount, total: accounts.length, data: accounts });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/google-sync-accounts/:id", requireAuth, requirePermission("setting.manage"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { clinicName, doctorName, email, phone, notes, status } = req.body;
    const record = await db.select().from(settings).where(eq(settings.id, "google_sync_accounts")).limit(1);
    let accounts: any[] = Array.isArray(record[0]?.value) ? record[0].value : [];

    const index = accounts.findIndex((a: any) => a.id === id);
    if (index === -1) {
      throw new BadRequestError("Không tìm thấy tài khoản Gmail cần cập nhật");
    }

    accounts[index] = {
      ...accounts[index],
      clinicName: clinicName !== undefined ? clinicName.trim() : accounts[index].clinicName,
      doctorName: doctorName !== undefined ? doctorName.trim() : accounts[index].doctorName,
      email: email !== undefined ? email.trim().toLowerCase() : accounts[index].email,
      phone: phone !== undefined ? phone.trim() : accounts[index].phone,
      notes: notes !== undefined ? notes.trim() : accounts[index].notes,
      status: status || accounts[index].status,
      updatedAt: new Date().toISOString()
    };

    await db.insert(settings)
      .values({ id: "google_sync_accounts", value: accounts })
      .onConflictDoUpdate({ target: settings.id, set: { value: accounts } });

    res.json({ success: true, data: accounts[index] });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/google-sync-accounts/:id", requireAuth, requirePermission("setting.manage"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await db.select().from(settings).where(eq(settings.id, "google_sync_accounts")).limit(1);
    let accounts: any[] = Array.isArray(record[0]?.value) ? record[0].value : [];

    accounts = accounts.filter((a: any) => a.id !== id);

    await db.insert(settings)
      .values({ id: "google_sync_accounts", value: accounts })
      .onConflictDoUpdate({ target: settings.id, set: { value: accounts } });

    res.json({ success: true, message: "Đã xóa tài khoản Gmail phòng khám thành công" });
  } catch (error) {
    next(error);
  }
});

export default adminRouter;
