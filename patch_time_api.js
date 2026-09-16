import fs from 'fs';
let file = 'server/api/appointments/index.ts';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `appointmentRouter.patch("/:id/time", requirePermission("appointment.update"), async (req, res, next) => {
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
});`;

const newStr = `appointmentRouter.patch("/:id/time", requirePermission("appointment.update"), async (req, res, next) => {
  try {
    const { startAt, endAt } = req.body;

    const oldApt = await db.select().from(appointments).where(eq(appointments.id, req.params.id)).limit(1);
    
    const updated = await db.update(appointments)
      .set({ 
        startAt: new Date(startAt), 
        endAt: new Date(endAt),
        updatedAt: new Date()
      })
      .where(eq(appointments.id, req.params.id))
      .returning();
    
    if (updated.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");

    // Trigger waitlist since the old slot is now freed up
    if (oldApt.length > 0) {
      triggerWaitlistMatching(oldApt[0]).catch(console.error);
    }

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});`;

code = code.replace(targetStr, newStr);

fs.writeFileSync(file, code);
