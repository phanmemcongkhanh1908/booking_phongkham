import { db, loadStore, persistStore } from "../db/index.js";
import { hashPassword } from "./security.js";
import { bootstrapSystem } from "./bootstrap.js";

export interface WipeOptions {
  mode?: "clean_demo" | "full_reset";
  tenantId?: string;
  isFullAdmin?: boolean;
}

/**
 * Dọn dẹp dữ liệu demo hoặc reset hệ thống an toàn,
 * tuân thủ chặt chẽ thứ tự quan hệ khóa ngoại (Foreign Key Dependency Order):
 *   1. audit_logs (child of appointments/users)
 *   2. patient_recalls (child of patients, appointments)
 *   3. waitlist (child of patients, services, providers)
 *   4. appointment_holds (child of patients, appointments, services, providers)
 *   5. appointments (child of patients, providers, services)
 *   6. patients (parent of appointments, recalls, waitlist)
 *   7. (Nếu Full Reset): provider_services, services, providers
 */
export async function wipeClinicData(options: WipeOptions = {}) {
  const mode = options.mode || "clean_demo";
  const tenantId = options.tenantId;
  const isFullAdmin = options.isFullAdmin !== false;

  console.log(`[Wipe] Starting procedure with mode='${mode}', tenantId='${tenantId || "ALL"}'...`);

  const store = loadStore();
  const wipedCounts: Record<string, number> = {
    appointments: 0,
    patients: 0,
    appointment_holds: 0,
    waitlist: 0,
    patient_recalls: 0,
    audit_logs: 0,
    push_subscriptions: 0,
  };

  // Helper kiểm tra xem bản ghi có thuộc tenant đang dọn dẹp hay không
  const belongsToTenant = (item: any): boolean => {
    if (!tenantId) return true; // Toàn hệ thống
    return item.tenantId === tenantId;
  };

  // 1. Xác định danh sách ID lịch hẹn và bệnh nhân mục tiêu cần xóa
  const allAppointments = Object.entries(store["appointments"] || {});
  const targetAptEntries = allAppointments.filter(([_, apt]: [string, any]) => belongsToTenant(apt));
  const targetAptIds = new Set(targetAptEntries.map(([_, apt]: [string, any]) => apt.id));

  const targetPatientIdsFromApts = new Set<string>();
  targetAptEntries.forEach(([_, apt]: [string, any]) => {
    if (apt.patientId) targetPatientIdsFromApts.add(apt.patientId);
  });

  const allPatients = Object.entries(store["patients"] || {});
  const targetPatientEntries = allPatients.filter(([_, pt]: [string, any]) => {
    if (!tenantId) return true;
    return pt.tenantId === tenantId || targetPatientIdsFromApts.has(pt.id);
  });
  const targetPatientIds = new Set(targetPatientEntries.map(([_, pt]: [string, any]) => pt.id));

  // 2. XÓA BẢNG CON TRƯỚC: audit_logs
  if (store["audit_logs"]) {
    let count = 0;
    for (const [key, log] of Object.entries(store["audit_logs"] as Record<string, any>)) {
      if (
        !tenantId ||
        log.tenantId === tenantId ||
        (log.appointmentId && targetAptIds.has(log.appointmentId)) ||
        (log.entityId && (targetAptIds.has(log.entityId) || targetPatientIds.has(log.entityId)))
      ) {
        delete store["audit_logs"][key];
        count++;
      }
    }
    wipedCounts.audit_logs = count;
  }

  // 3. XÓA BẢNG CON: patient_recalls
  if (store["patient_recalls"]) {
    let count = 0;
    for (const [key, recall] of Object.entries(store["patient_recalls"] as Record<string, any>)) {
      if (
        !tenantId ||
        recall.tenantId === tenantId ||
        (recall.patientId && targetPatientIds.has(recall.patientId)) ||
        (recall.appointmentId && targetAptIds.has(recall.appointmentId))
      ) {
        delete store["patient_recalls"][key];
        count++;
      }
    }
    wipedCounts.patient_recalls = count;
  }

  // 4. XÓA BẢNG CON: waitlist
  if (store["waitlist"]) {
    let count = 0;
    for (const [key, w] of Object.entries(store["waitlist"] as Record<string, any>)) {
      if (!tenantId || w.tenantId === tenantId || (w.patientId && targetPatientIds.has(w.patientId))) {
        delete store["waitlist"][key];
        count++;
      }
    }
    wipedCounts.waitlist = count;
  }

  // 5. XÓA BẢNG CON: appointment_holds
  if (store["appointment_holds"]) {
    let count = 0;
    for (const [key, hold] of Object.entries(store["appointment_holds"] as Record<string, any>)) {
      if (
        !tenantId ||
        hold.tenantId === tenantId ||
        (hold.appointmentId && targetAptIds.has(hold.appointmentId)) ||
        (hold.patientId && targetPatientIds.has(hold.patientId))
      ) {
        delete store["appointment_holds"][key];
        count++;
      }
    }
    wipedCounts.appointment_holds = count;
  }

  // 6. XÓA BẢNG CON: push_subscriptions
  if (store["push_subscriptions"]) {
    let count = 0;
    for (const [key, sub] of Object.entries(store["push_subscriptions"] as Record<string, any>)) {
      if (!tenantId || sub.tenantId === tenantId || (sub.patientId && targetPatientIds.has(sub.patientId))) {
        delete store["push_subscriptions"][key];
        count++;
      }
    }
    wipedCounts.push_subscriptions = count;
  }

  // 7. XÓA BẢNG CHA CỦA HOLDS/LOGS: appointments
  if (store["appointments"]) {
    let count = 0;
    for (const [key, apt] of targetAptEntries) {
      delete store["appointments"][key];
      count++;
    }
    wipedCounts.appointments = count;
  }

  // 8. XÓA BẢNG CHA CỦA APPOINTMENTS: patients
  if (store["patients"]) {
    let count = 0;
    for (const [key, _] of targetPatientEntries) {
      delete store["patients"][key];
      count++;
    }
    wipedCounts.patients = count;
  }

  // 9. NẾU LÀ FULL RESET: Dọn dẹp thêm dịch vụ & bác sĩ & tài nguyên
  if (mode === "full_reset") {
    const fullResetTables = ["provider_services", "resources", "services", "providers"];
    for (const tbl of fullResetTables) {
      if (store[tbl]) {
        let count = 0;
        for (const [key, item] of Object.entries(store[tbl] as Record<string, any>)) {
          if (!tenantId || item.tenantId === tenantId) {
            delete store[tbl][key];
            count++;
          }
        }
        wipedCounts[tbl] = count;
      }
    }

    // Bảo tồn Admin Account & Role
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
    } catch (err: any) {
      console.warn("[Wipe] Role safeguard warning:", err.message);
    }

    try {
      if (!store["users"]) store["users"] = {};
      const defaultPasswordHash = await hashPassword(defaultAdminPassword);
      let foundAdmin = false;

      for (const [userId, userData] of Object.entries(store["users"] as Record<string, any>)) {
        const u = userData;
        const email = (u.email || "").toLowerCase().trim();

        if (email === defaultAdminEmail || email === "admin") {
          foundAdmin = true;
          store["users"][userId] = {
            ...u,
            email: email,
            passwordHash: defaultPasswordHash,
            roleId: adminRoleId,
            isActive: true,
            updatedAt: new Date().toISOString(),
          };
        } else if (u.slug || u.clinicName || u.tenantId) {
          // BẢO TỒN TÀI KHOẢN CỦA PHÒNG KHÁM ĐỂ KHÔNG MẤT LINK SLUG
          console.log(`[Wipe] Preserved clinic user: ${email} (${u.slug || u.clinicName})`);
        } else if (!tenantId) {
          delete store["users"][userId];
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
      }
    } catch (err: any) {
      console.warn("[Wipe] User safeguard warning:", err.message);
    }

    persistStore();

    // Re-seed default services & provider
    try {
      await bootstrapSystem();
      console.log("[Wipe] Re-bootstrapped fresh clinic services & default provider.");
    } catch (err: any) {
      console.warn("[Wipe] Error during re-bootstrap:", err.message);
    }
  } else {
    // Mode clean_demo: Lưu thay đổi ngay lập tức
    persistStore();
  }

  console.log(`[Wipe] Data cleaning finished successfully. Summary:`, wipedCounts);

  const defaultAdminEmail = "admin@dentalsmartbooking.com";
  const defaultAdminPassword = "admin@123";

  return {
    success: true,
    mode: mode,
    message:
      mode === "clean_demo"
        ? "Đã dọn dẹp sạch toàn bộ dữ liệu lịch hẹn và khách hàng demo an toàn. Danh mục dịch vụ, bác sĩ và cấu hình phòng khám được giữ nguyên vẹn."
        : "Đã reset toàn bộ dữ liệu hệ thống an toàn. Dịch vụ chuẩn & bác sĩ mặc định đã được khởi tạo mới.",
    preservedAccount: {
      email: defaultAdminEmail,
      defaultPassword: defaultAdminPassword,
      role: "admin",
      status: "Active",
    },
    wipedSummary: wipedCounts,
  };
}
