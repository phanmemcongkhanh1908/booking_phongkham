const fs = require('fs');

const filePath = 'server/api/appointments/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldNextRoute = `appointmentRouter.post("/next", requirePermission("appointment.create"), async (req, res, next) => {
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
});`;

const newNextRoute = `appointmentRouter.post("/next", requirePermission("appointment.create"), async (req, res, next) => {
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

// Quick book from calendar
appointmentRouter.post("/quick", requirePermission("appointment.create"), async (req, res, next) => {
  try {
    const { patientName, phone, serviceId, startAt, endAt } = req.body;
    if (!patientName || !phone || !serviceId || !startAt || !endAt) {
      throw new BadRequestError("Thiếu thông tin bắt buộc");
    }

    const bookingResult = await db.transaction(async (tx) => {
      let patientRecords = await tx.select().from(patients).where(eq(patients.phone, phone)).limit(1);
      let patientId = '';

      if (patientRecords.length === 0) {
        const newPatient = await tx.insert(patients).values({
          fullName: patientName,
          phone: phone,
        }).returning();
        patientId = newPatient[0].id;
      } else {
        patientId = patientRecords[0].id;
      }

      const providerRecords = await tx.select().from(providers).limit(1);
      if (providerRecords.length === 0) {
        throw new BadRequestError("Không có bác sĩ nào trong hệ thống");
      }

      const newAppointment = await tx.insert(appointments).values({
        patientId,
        providerId: providerRecords[0].id,
        serviceId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        status: "CONFIRMED",
        source: "CLINIC"
      }).returning();
      
      return newAppointment[0];
    });

    res.json({ success: true, data: bookingResult });
  } catch (error) {
    next(error);
  }
});`;

content = content.replace(oldNextRoute, newNextRoute);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated appointment router");
