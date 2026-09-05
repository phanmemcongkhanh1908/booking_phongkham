import { db } from "../db/index.js";
import { roles, users, providers } from "../db/schema.js";
import { hashPassword } from "./security.js";
import { eq } from "drizzle-orm";

export const bootstrapSystem = async () => {
  try {
    // Ensure Admin Role exists
    const adminRoleRecords = await db.select().from(roles).where(eq(roles.name, "admin"));
    let adminRoleId;
    if (adminRoleRecords.length === 0) {
      const inserted = await db.insert(roles).values({
        name: "admin",
        permissions: ["all"]
      }).returning({ id: roles.id });
      adminRoleId = inserted[0].id;
      console.log("[Bootstrap] Created 'admin' role.");
    } else {
      adminRoleId = adminRoleRecords[0].id;
    }

    // Ensure Default Admin User exists
    const adminEmail = "admin@dentalsmartbooking.com";
    const adminUserRecords = await db.select().from(users).where(eq(users.email, adminEmail));
    if (adminUserRecords.length === 0) {
      const passwordHash = await hashPassword("admin@123");
      await db.insert(users).values({
        email: adminEmail,
        passwordHash,
        roleId: adminRoleId,
        isActive: true
      });
      console.log(`[Bootstrap] Created default admin account: ${adminEmail} / admin@123`);
    }

    // Ensure at least one active provider exists
    const providerRecords = await db.select().from(providers).where(eq(providers.isActive, true)).limit(1);
    if (providerRecords.length === 0) {
      const defaultWorkingHours = {
        "monday": [{ "start": "08:00", "end": "17:00" }],
        "tuesday": [{ "start": "08:00", "end": "17:00" }],
        "wednesday": [{ "start": "08:00", "end": "17:00" }],
        "thursday": [{ "start": "08:00", "end": "17:00" }],
        "friday": [{ "start": "08:00", "end": "17:00" }]
      };
      await db.insert(providers).values({
        name: "Bác sĩ chuyên khoa",
        specialty: "Nha khoa tổng quát",
        workingHours: defaultWorkingHours,
        bookingEnabled: true,
        isActive: true
      });
      console.log(`[Bootstrap] Created default provider.`);
    }

  } catch (error) {
    console.error("[Bootstrap] Error bootstrapping system:", error);
  }
};
