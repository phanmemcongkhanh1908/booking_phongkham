import { Router } from "express";
import { db } from "../../db/index.js";
import { patientRecalls, patients, services } from "../../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../../core/middleware.js";

const recallRouter = Router();

// Phải đăng nhập
recallRouter.use(requireAuth);

// [M10] Lấy danh sách bệnh nhân cần gọi tái khám
recallRouter.get("/", requirePermission("recall.view"), async (req, res, next) => {
  try {
    const results = await db
      .select({
        id: patientRecalls.id,
        dueDate: patientRecalls.dueDate,
        status: patientRecalls.status,
        patientId: patients.id,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        serviceId: services.id,
        serviceName: services.name,
      })
      .from(patientRecalls)
      .leftJoin(patients, eq(patientRecalls.patientId, patients.id))
      .leftJoin(services, eq(patientRecalls.serviceId, services.id))
      .orderBy(asc(patientRecalls.dueDate)); // Sắp xếp dueDate từ cũ đến mới để ưu tiên gọi trước

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

export default recallRouter;
