import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

// Add rate limiter to post("/appointments")
code = code.replace(
  'publicRouter.post("/appointments", async (req, res, next) => {',
  'publicRouter.post("/appointments", bookingHoldLimiter, async (req, res, next) => {'
);

// Add overlap check inside the transaction for post("/appointments")
const targetStr = `      // 4. Create the Appointment
      const newAppointment = await tx.insert(appointments).values({`;

const replaceStr = `      // 4. Check for overlap again just to be safe (prevent race condition bypass)
      const conflictingBookings = await tx.select().from(appointments).where(
        and(
          eq(appointments.providerId, hold.providerId),
          lt(appointments.startAt, aptEndAt),
          gt(appointments.endAt, aptStartAt),
          sql\`\${appointments.status} NOT IN ('CANCELLED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC')\`
        )
      );

      if (conflictingBookings.length > 0) {
        throw new ConflictError("Khung giờ này đã có người khác đặt trong tích tắc. Vui lòng thử lại với giờ khác.");
      }

      // 5. Create the Appointment
      const newAppointment = await tx.insert(appointments).values({`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync(file, code);
