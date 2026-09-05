import { db } from "../db/index.js";
import { patientRecalls, services } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { addDays, format } from "date-fns";

/**
 * ENGINE: RECALL GENERATOR
 * Được kích hoạt khi Lịch hẹn chuyển sang trạng thái COMPLETED
 */
export async function generateRecall(appointment: any) {
  try {
    // Lấy thông tin dịch vụ để xem có cấu hình Recall không
    const serviceRecords = await db.select().from(services).where(eq(services.id, appointment.serviceId)).limit(1);
    
    if (serviceRecords.length === 0) return;
    
    const service = serviceRecords[0];
    
    // Nếu dịch vụ có yêu cầu tái khám (ví dụ: Cạo vôi răng = 180 ngày)
    if (service.recallIntervalDays && service.recallIntervalDays > 0) {
      const dueDate = addDays(new Date(appointment.endAt), service.recallIntervalDays);
      
      // Tạo bản ghi Recall
      await db.insert(patientRecalls).values({
        patientId: appointment.patientId,
        serviceId: appointment.serviceId,
        dueDate: format(dueDate, "yyyy-MM-dd"), // Lưu dạng YYYY-MM-DD string cho date field
        status: "DUE"
      });
      
      console.log(`[Recall] Đã tạo lịch tái khám cho BN ${appointment.patientId} vào ${format(dueDate, "yyyy-MM-dd")}`);
    }
  } catch (error) {
    console.error("[Recall] Lỗi khi tạo recall:", error);
  }
}
