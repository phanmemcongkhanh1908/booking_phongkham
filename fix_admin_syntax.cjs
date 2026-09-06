const fs = require('fs');
const path = 'server/api/admin/index.ts';
let content = fs.readFileSync(path, 'utf8');

const faultyStr = `adminRouter.post("/wipe", requireAuth, requirePermission("*"), async (req, res, next) => {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql\`TRUNCATE TABLE appointments, patients, services, providers, patient_recalls, waitlist, push_subscriptions, provider_services, appointment_holds CASCADE\`);
    res.json({ success: true, message: "All data wiped" });
  } catch (error) {
    next(error);
  }
});
  } catch (error) {
    next(error);
  }
});`;

const fixedStr = `adminRouter.post("/wipe", requireAuth, requirePermission("*"), async (req, res, next) => {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql\`TRUNCATE TABLE appointments, patients, services, providers, patient_recalls, waitlist, push_subscriptions, provider_services, appointment_holds CASCADE\`);
    res.json({ success: true, message: "All data wiped" });
  } catch (error) {
    next(error);
  }
});`;

content = content.replace(faultyStr, fixedStr);

fs.writeFileSync(path, content);
