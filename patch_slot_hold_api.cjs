const fs = require('fs');
let code = fs.readFileSync('server/api/public/index.ts', 'utf8');

// Add slot hold endpoint
const newEndpoint = `
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
`;

code = code.replace(`export default publicRouter;`, newEndpoint + `\nexport default publicRouter;`);

// Make sure `appointmentHolds` and `eq` are imported
if (!code.includes('appointmentHolds')) {
  code = code.replace(
    `import { patients, appointments, services, providers, providerServices, settings } from "../../db/schema.js";`,
    `import { patients, appointments, services, providers, providerServices, settings, appointmentHolds } from "../../db/schema.js";`
  );
}

fs.writeFileSync('server/api/public/index.ts', code);
console.log('Slot hold API added.');
