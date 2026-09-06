import { db } from "../db/index.js";
import { roles, users, providers, services, settings } from "../db/schema.js";
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
        name: "Bác sĩ Chuyên khoa Răng Hàm Mặt",
        specialty: "Nha khoa tổng quát & Thẩm mỹ",
        workingHours: defaultWorkingHours,
        bookingEnabled: true,
        isActive: true
      });
      console.log(`[Bootstrap] Created default provider.`);
    }

    // Ensure Default Dental Services exist
    const existingServices = await db.select().from(services);
    if (existingServices.length === 0) {
      const defaultServices = [
        {
          name: "Khám răng tổng quát & Tư vấn",
          description: "Khám kiểm tra sức khỏe răng miệng toàn diện, chụp phim X-quang kiểm tra tổng quát.",
          durationMins: 30,
          price: 0,
          bufferBefore: 0,
          bufferAfter: 10
        },
        {
          name: "Cạo vôi răng & Đánh bóng",
          description: "Làm sạch mảng bám, vôi răng bằng sóng siêu âm không đau, đánh bóng men răng.",
          durationMins: 30,
          price: 200000,
          bufferBefore: 5,
          bufferAfter: 10
        },
        {
          name: "Trám răng thẩm mỹ Composite",
          description: "Phục hồi hình thể răng sâu, mẻ với vật liệu Composite trùng màu răng tự nhiên.",
          durationMins: 45,
          price: 350000,
          bufferBefore: 5,
          bufferAfter: 10
        },
        {
          name: "Nhổ răng khôn / Tiểu phẫu",
          description: "Tiểu phẫu nhổ răng khôn mọc lệch, ngầm an toàn bằng công nghệ Piezotome.",
          durationMins: 60,
          price: 1200000,
          bufferBefore: 10,
          bufferAfter: 15
        },
        {
          name: "Tẩy trắng răng công nghệ cao",
          description: "Tẩy trắng răng bằng ánh sáng Laser/LED hiện đại, bật từ 2-4 tông màu an toàn.",
          durationMins: 60,
          price: 1500000,
          bufferBefore: 10,
          bufferAfter: 15
        }
      ];

      for (const s of defaultServices) {
        await db.insert(services).values(s);
      }
      console.log("[Bootstrap] Seeded default dental services.");
    }

    // Ensure Clinic Profile Setting exists
    const existingProfile = await db.select().from(settings).where(eq(settings.key, "clinic_profile"));
    if (existingProfile.length === 0) {
      await db.insert(settings).values({
        key: "clinic_profile",
        value: {
          name: "Nha Khoa Dental Smart",
          address: "123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
          phone: "0901 234 567",
          email: "contact@dentalsmartbooking.com",
          workingHours: "08:00 - 17:00 (Thứ 2 - Thứ 7)",
          description: "Phòng khám nha khoa kỹ thuật cao, tận tâm, hiện đại."
        }
      });
      console.log("[Bootstrap] Seeded default clinic profile.");
    }
  } catch (error) {
    console.error("[Bootstrap] Error bootstrapping system:", error);
  }
};
