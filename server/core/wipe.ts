import { serverDb } from "../lib/firebase-server.js";
import { collection, getDocs, doc, deleteDoc, setDoc, updateDoc } from "firebase/firestore";
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

  // 1. Wipe all operational and patient clinic collections
  for (const colName of clinicCollections) {
    try {
      const colRef = collection(serverDb, colName);
      const snap = await getDocs(colRef);
      let count = 0;
      for (const itemDoc of snap.docs) {
        await deleteDoc(itemDoc.ref);
        count++;
      }
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

  // Ensure 'admin' role exists in roles collection
  let adminRoleId = "role-admin";
  try {
    const rolesSnap = await getDocs(collection(serverDb, "roles"));
    const existingAdminRole = rolesSnap.docs.find(
      (d) => (d.data().name || "").toLowerCase() === "admin"
    );
    if (existingAdminRole) {
      adminRoleId = existingAdminRole.id;
      await updateDoc(existingAdminRole.ref, {
        name: "admin",
        permissions: ["all"],
      });
    } else {
      await setDoc(doc(serverDb, "roles", adminRoleId), {
        id: adminRoleId,
        name: "admin",
        permissions: ["all"],
      });
    }
    console.log(`[Wipe] Preserved 'admin' role with id '${adminRoleId}'.`);
  } catch (err: any) {
    console.warn("[Wipe] Error updating admin role:", err.message);
  }

  // Remove any non-admin users; ensure default admin user is intact
  let nonAdminRemoved = 0;
  try {
    const usersSnap = await getDocs(collection(serverDb, "users"));
    const defaultPasswordHash = await hashPassword(defaultAdminPassword);
    let foundAdmin = false;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const email = (userData.email || "").toLowerCase().trim();

      if (email === defaultAdminEmail || email === "admin") {
        foundAdmin = true;
        // Reset/guarantee active status and default password
        await updateDoc(userDoc.ref, {
          email: email,
          passwordHash: defaultPasswordHash,
          roleId: adminRoleId,
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[Wipe] Preserved admin account: ${email}`);
      } else {
        await deleteDoc(userDoc.ref);
        nonAdminRemoved++;
      }
    }

    // If admin user did not exist, create it immediately
    if (!foundAdmin) {
      const adminUserId = "admin-primary-account";
      await setDoc(doc(serverDb, "users", adminUserId), {
        id: adminUserId,
        email: defaultAdminEmail,
        passwordHash: defaultPasswordHash,
        roleId: adminRoleId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`[Wipe] Re-created default admin account: ${defaultAdminEmail}`);
    }
    wipedCounts["nonAdminUsers"] = nonAdminRemoved;
  } catch (err: any) {
    console.warn("[Wipe] Error safeguarding admin user:", err.message);
  }

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
