import { db } from "../db/index.js";
import { roles, users } from "../db/schema.js";
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
    } else {
      // (Optional) Reset password if it exists but user can't login, 
      // but let's just leave it alone if it exists.
    }
  } catch (error) {
    console.error("[Bootstrap] Error bootstrapping system:", error);
  }
};
