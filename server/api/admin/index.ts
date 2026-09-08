import { Router } from "express";
import { db } from "../../db/index.js";
import { services, providers, settings, appointments, patients } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";

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

adminRouter.post("/services", async (req, res, next) => {
  try {
    const newService = await db.insert(services).values({
      name: req.body.name,
      description: req.body.description,
      durationMins: parseInt(req.body.durationMins),
      bufferBefore: parseInt(req.body.bufferBefore) || 0,
      bufferAfter: parseInt(req.body.bufferAfter) || 0,
      price: req.body.price ? parseInt(req.body.price.toString().replace(/\D/g, '')) : null,
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

adminRouter.put("/services/:id", async (req, res, next) => {
  try {
    const updated = await db.update(services).set({
      name: req.body.name,
      description: req.body.description,
      durationMins: parseInt(req.body.durationMins),
      bufferBefore: parseInt(req.body.bufferBefore) || 0,
      bufferAfter: parseInt(req.body.bufferAfter) || 0,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      price: req.body.price ? parseInt(req.body.price.toString().replace(/\D/g, '')) : null,
      showPrice: Boolean(req.body.showPrice),
      isHot: Boolean(req.body.isHot),
      isFree: Boolean(req.body.isFree),
    }).where(eq(services.id, req.params.id)).returning();
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/services/:id", async (req, res, next) => {
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

adminRouter.post("/providers", async (req, res, next) => {
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

adminRouter.put("/providers/:id", async (req, res, next) => {
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

adminRouter.delete("/providers/:id", async (req, res, next) => {
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


adminRouter.post("/wipe", requireAuth, requirePermission("*"), async (req, res, next) => {
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

// Lấy dữ liệu thống kê
adminRouter.get("/analytics", requireAuth, async (req, res, next) => {
  try {
    // Phân tích Dịch vụ mũi nhọn & Tỉ lệ lấp đầy
    const allAppointments = await db.select().from(appointments);
    const allServices = await db.select().from(services);
    
    const serviceMap: any = {};
    allServices.forEach((s: any) => {
      serviceMap[s.id] = s;
    });

    const serviceStatsMap: any = {};
    
    // Tỉ lệ lấp đầy & Hủy theo ngày trong 7 ngày qua
    const occupancyStatsMap: any = {};
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      occupancyStatsMap[dateStr] = { date: dateStr, completed: 0, cancelled: 0, total: 0, revenue: 0 };
    }
    
    // Thống kê lịch hẹn theo ngày, tuần và tỷ lệ khách hàng quay lại
    const appointmentsByDay: Record<string, number> = {};
    const appointmentsByWeek: Record<string, number> = {};
    const patientVisits: Record<string, number> = {};

    allAppointments.forEach((a: any) => {
      // Dịch vụ mũi nhọn
      if (a.status === 'COMPLETED' && a.serviceId) {
        if (!serviceStatsMap[a.serviceId]) {
          serviceStatsMap[a.serviceId] = {
            name: serviceMap[a.serviceId]?.name || 'Khác',
            count: 0,
            revenue: 0
          };
        }
        serviceStatsMap[a.serviceId].count += 1;
        serviceStatsMap[a.serviceId].revenue += Number(serviceMap[a.serviceId]?.price || 0);
      }
      
      // Lấp đầy, Hủy & Doanh thu
      if (a.startAt) {
         const date = new Date(a.startAt);
         const dateStr = date.toISOString().split('T')[0];
         
         if (occupancyStatsMap[dateStr]) {
            occupancyStatsMap[dateStr].total += 1;
            if (a.status === 'COMPLETED') {
              occupancyStatsMap[dateStr].completed += 1;
              if (a.serviceId) {
                occupancyStatsMap[dateStr].revenue += Number(serviceMap[a.serviceId]?.price || 0);
              }
            }
            if (a.status === 'NO_SHOW' || a.status === 'CANCEL_PATIENT' || a.status === 'CANCEL_CLINIC') {
              occupancyStatsMap[dateStr].cancelled += 1;
            }
         }

         // Đếm theo ngày (cho toàn thời gian)
         appointmentsByDay[dateStr] = (appointmentsByDay[dateStr] || 0) + 1;

         // Đếm theo tuần (VD: "2026-W36")
         // Hàm lấy số tuần đơn giản
         const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
         const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
         const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
         const weekStr = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
         appointmentsByWeek[weekStr] = (appointmentsByWeek[weekStr] || 0) + 1;
      }

      // Đếm số lần khám của bệnh nhân (để tính tỉ lệ quay lại)
      if (a.status === 'COMPLETED' && a.patientId) {
        patientVisits[a.patientId] = (patientVisits[a.patientId] || 0) + 1;
      }
    });

    // Tính tỷ lệ khách hàng quay lại
    const totalPatientsWithCompletedAppt = Object.keys(patientVisits).length;
    const returningPatients = Object.values(patientVisits).filter((count: number) => count > 1).length;
    const returningRate = totalPatientsWithCompletedAppt > 0 
      ? Math.round((returningPatients / totalPatientsWithCompletedAppt) * 100) 
      : 0;

    // Sắp xếp ngày và tuần để gửi về FE (lấy 14 ngày gần nhất, 10 tuần gần nhất)
    const sortedDays = Object.entries(appointmentsByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    const sortedWeeks = Object.entries(appointmentsByWeek)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([week, count]) => ({ week, count }));

    res.json({
      success: true,
      data: {
        serviceStats: Object.values(serviceStatsMap),
        occupancyStats: Object.values(occupancyStatsMap),
        appointmentsByDay: sortedDays,
        appointmentsByWeek: sortedWeeks,
        returningRate,
        totalPatients: totalPatientsWithCompletedAppt,
        returningPatients
      }
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
      settingsObj[s.id] = s.value;
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
adminRouter.post("/settings", requireAuth, requirePermission("*"), async (req, res, next) => {
  try {
    const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig, bookingFormConfig } = req.body;
    
    // Save to DB
    if (telegramToken !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramToken', value: telegramToken })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramToken } });
    }
    if (telegramChatId !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramChatId', value: telegramChatId })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramChatId } });
    }
    if (telegramBotUsername !== undefined) {
      await db.insert(settings)
        .values({ id: 'telegramBotUsername', value: telegramBotUsername })
        .onConflictDoUpdate({ target: settings.id, set: { value: telegramBotUsername } });
    }
    if (clinicProfile !== undefined) {
      await db.insert(settings)
        .values({ id: 'clinicProfile', value: clinicProfile })
        .onConflictDoUpdate({ target: settings.id, set: { value: clinicProfile } });
    }
    if (emailConfig !== undefined) {
      await db.insert(settings)
        .values({ id: 'emailConfig', value: emailConfig })
        .onConflictDoUpdate({ target: settings.id, set: { value: emailConfig } });
    }
    if (bookingFormConfig !== undefined) {
      await db.insert(settings)
        .values({ id: 'bookingFormConfig', value: bookingFormConfig })
        .onConflictDoUpdate({ target: settings.id, set: { value: bookingFormConfig } });
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

export default adminRouter;
