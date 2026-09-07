import { db, loadStore, persistStore } from "../db/index.js";
import { hashPassword } from "./security.js";
import { bootstrapSystem } from "./bootstrap.js";

export async function wipeClinicData() {
  console.log("[Wipe] Starting clinic data wipe procedure...");

  // Collections that belong purely to clinic operations & patients
  const clinicCollections = [
    "appointments",
    "appointment_holds",
    "patients",
    "waitlist",
    "patient_recalls",
    "push_subscriptions",
    "audit_logs",
    "resources",
    "provider_services",
    "services",
    "providers",
  ];

  const wipedCounts: Record<string, number> = {};
  const store = loadStore();

  // 1. Wipe all operational and patient clinic collections
  for (const colName of clinicCollections) {
    try {
      const count = Object.keys(store[colName] || {}).length;
      store[colName] = {};
      wipedCounts[colName] = count;
      console.log(`[Wipe] Cleared ${count} records from '${colName}'.`);
    } catch (err: any) {
      console.warn(`[Wipe] Warning while clearing '${colName}':`, err.message);
      wipedCounts[colName] = 0;
    }
  }

  // 2. Protect Admin Account & Role: Delete any non-admin users, preserve admin user
  const defaultAdminEmail = "admin@dentalsmartbooking.com";
  const defaultAdminPassword = "admin@123";

  let adminRoleId = "role-admin";
  try {
    if (!store["roles"]) store["roles"] = {};
    const rolesList = Object.values(store["roles"]);
    const existingAdminRole: any = rolesList.find(
      (d: any) => (d.name || "").toLowerCase() === "admin"
    );
    if (existingAdminRole) {
      adminRoleId = existingAdminRole.id;
      store["roles"][adminRoleId] = {
        ...existingAdminRole,
        name: "admin",
        permissions: ["all"],
      };
    } else {
      store["roles"][adminRoleId] = {
        id: adminRoleId,
        name: "admin",
        permissions: ["all"],
      };
    }
    console.log(`[Wipe] Preserved 'admin' role with id '${adminRoleId}'.`);
  } catch (err: any) {
    console.warn("[Wipe] Error updating admin role:", err.message);
  }

  // Remove any non-admin users; ensure default admin user is intact
  let nonAdminRemoved = 0;
  try {
    if (!store["users"]) store["users"] = {};
    const defaultPasswordHash = await hashPassword(defaultAdminPassword);
    let foundAdmin = false;

    const userEntries = Object.entries(store["users"]);
    for (const [userId, userData] of userEntries) {
      const email = ((userData as any).email || "").toLowerCase().trim();

      if (email === defaultAdminEmail || email === "admin") {
        foundAdmin = true;
        store["users"][userId] = {
          ...(userData as any),
          email: email,
          passwordHash: defaultPasswordHash,
          roleId: adminRoleId,
          isActive: true,
          updatedAt: new Date().toISOString(),
        };
        console.log(`[Wipe] Preserved admin account: ${email}`);
      } else {
        delete store["users"][userId];
        nonAdminRemoved++;
      }
    }

    if (!foundAdmin) {
      const adminUserId = "admin-primary-account";
      store["users"][adminUserId] = {
        id: adminUserId,
        email: defaultAdminEmail,
        passwordHash: defaultPasswordHash,
        roleId: adminRoleId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      console.log(`[Wipe] Re-created default admin account: ${defaultAdminEmail}`);
    }
    wipedCounts["nonAdminUsers"] = nonAdminRemoved;
  } catch (err: any) {
    console.warn("[Wipe] Error safeguarding admin user:", err.message);
  }

  persistStore();

  // 3. Re-run bootstrapSystem to seed fresh default services, default provider, and clinic profile
  try {
    await bootstrapSystem();
    console.log("[Wipe] Re-bootstrapped fresh clinic services & default provider.");
  } catch (err: any) {
    console.warn("[Wipe] Error during re-bootstrap:", err.message);
  }

  console.log("[Wipe] Clinic data wipe completed successfully.");

  return {
    success: true,
    message: "Toàn bộ dữ liệu phòng khám đã được xóa sạch. Tài khoản quản trị và mật khẩu mặc định được bảo tồn nguyên vẹn.",
    preservedAccount: {
      email: defaultAdminEmail,
      defaultPassword: defaultAdminPassword,
      role: "admin",
      status: "Active",
    },
    wipedSummary: wipedCounts,
  };
}
