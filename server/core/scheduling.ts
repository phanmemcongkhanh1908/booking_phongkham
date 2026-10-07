  import { db } from "../db/index.js";
import { appointments, appointmentHolds, providers, services, settings } from "../db/schema.js";
import { and, or, eq, gte, lt, gt, notInArray } from "drizzle-orm";
import { startOfDay, endOfDay, addMinutes, parse, format, isBefore, isAfter, isEqual } from "date-fns";
import { OccupiedSlot, AvailableSlot, WorkingHours } from "../../shared/scheduling.js";
import { BadRequestError } from "./errors.js";

/**
 * SCHEDULING ENGINE
 * Nhiệm vụ: Tìm kiếm các khoảng thời gian trống của một bác sĩ trong một ngày cụ thể
 * Tính toán Buffer, Duration, đụng độ (Conflict) với các Lịch đã chốt hoặc đang Hold.
 */

// Lấy danh sách khoảng thời gian bận của Bác sĩ trong ngày
export async function getProviderOccupiedSlots(providerId: string, targetDate: Date): Promise<OccupiedSlot[]> {
  const startDay = startOfDay(targetDate);
  const endDay = endOfDay(targetDate);

  // 1. Lấy các cuộc hẹn đã chốt/đang xử lý (Loại trừ Hủy/No Show)
  const bookedAppointments = await db
    .select({
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.providerId, providerId),
        lt(appointments.startAt, endDay),
        gt(appointments.endAt, startDay),
        notInArray(appointments.status, ["CANCELLED", "NO_SHOW", "CANCEL_PATIENT", "CANCEL_CLINIC"])
      )
    );

  // 2. Lấy các cuộc hẹn đang được "Hold" (giữ chỗ) chưa hết hạn
  const activeHolds = await db
    .select({
      startAt: appointmentHolds.startAt,
      endAt: appointmentHolds.endAt,
    })
    .from(appointmentHolds)
    .where(
      and(
        eq(appointmentHolds.providerId, providerId),
        gte(appointmentHolds.expiresAt, new Date()), // Chỉ lấy Hold chưa hết hạn
        lt(appointmentHolds.startAt, endDay),
        gt(appointmentHolds.endAt, startDay)
      )
    );

  const occupied: OccupiedSlot[] = [];
  
  bookedAppointments.forEach((a) => {
    occupied.push({ startAt: new Date(a.startAt), endAt: new Date(a.endAt), type: "APPOINTMENT" });
  });
  
  activeHolds.forEach((h) => {
    occupied.push({ startAt: new Date(h.startAt), endAt: new Date(h.endAt), type: "HOLD" });
  });

  // Sort by start time
  return occupied.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

// Kiểm tra xem một Slot có bị đè lên bất kỳ khoảng Occupied nào không
export function isSlotConflict(slotStart: Date, slotEnd: Date, occupiedSlots: OccupiedSlot[]): boolean {
  for (const occ of occupiedSlots) {
    // Nếu khoảng thời gian A bắt đầu trước khi B kết thúc và kết thúc sau khi B bắt đầu -> CONFLICT
    if (isBefore(slotStart, occ.endAt) && isAfter(slotEnd, occ.startAt)) {
      return true;
    }
  }
  return false;
}

// Tính toán các Slot trống trong một ngày
export async function calculateAvailableSlots(
  providerId: string,
  serviceId: string,
  targetDate: Date,
  options: { includeUnavailable?: boolean; customDurationMins?: number; serviceIds?: string[] } = {}
): Promise<AvailableSlot[]> {
  const { includeUnavailable = false, customDurationMins, serviceIds } = options;
  
  // 1. Lấy thông tin Bác sĩ & Dịch vụ (Hỗ trợ 1 hoặc nhiều dịch vụ gộp)
  const providerRecords = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
  if (providerRecords.length === 0) throw new BadRequestError("Không tìm thấy Bác sĩ");
  const provider = providerRecords[0];

  const targetServiceIds = serviceIds && serviceIds.length > 0 
    ? serviceIds 
    : (serviceId || "").includes(",") 
      ? serviceId.split(",").map(s => s.trim()).filter(Boolean)
      : [serviceId];

  const allServices: any[] = [];
  for (const sId of targetServiceIds) {
    const sRec = await db.select().from(services).where(eq(services.id, sId)).limit(1);
    if (sRec.length > 0) allServices.push(sRec[0]);
  }

  if (allServices.length === 0) {
    const fallbackService = await db.select().from(services).where(eq(services.id, targetServiceIds[0])).limit(1);
    if (fallbackService.length === 0) throw new BadRequestError("Không tìm thấy Dịch vụ");
    allServices.push(fallbackService[0]);
  }

  const primaryService = allServices[0];

  if (!provider.isActive || !provider.bookingEnabled) {
    return []; // Bác sĩ đang nghỉ hoặc khóa book
  }

  // 2. Phân tích giờ làm việc của Bác sĩ trong ngày hôm đó (Thứ 2 = 1, Chủ nhật = 0 -> date-fns)
  const dayOfWeek = targetDate.getDay();
  const dayKeys: (keyof WorkingHours)[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentDayKey = dayKeys[dayOfWeek];

  const workingHoursConfig = (provider.workingHours as unknown as WorkingHours) || {};
  const dayShifts = workingHoursConfig[currentDayKey] || [];

  if (dayShifts.length === 0) {
    return []; // Không có ca làm việc trong ngày này
  }

  // 3. Lấy khoảng thời gian bận
  const occupiedSlots = await getProviderOccupiedSlots(providerId, targetDate);

  // Tổng thời gian cần thiết = tổng duration của tất cả dịch vụ + buffer
  const combinedDuration = allServices.reduce((acc, s) => acc + (s.durationMins || 30), 0);
  const maxBufferBefore = Math.max(...allServices.map(s => s.bufferBefore || 0), 0);
  const maxBufferAfter = Math.max(...allServices.map(s => s.bufferAfter || 0), 0);

  const totalRequiredMins = customDurationMins || (maxBufferBefore + combinedDuration + maxBufferAfter);
  const now = new Date();
  const resultSlots: AvailableSlot[] = [];

  // 4. Chia các ca làm việc thành các Slot (Bước nhảy 30 phút mặc định)
  let INTERVAL_STEP = 30;
  try {
    const dbSettings = await db.select().from(settings).where(eq(settings.id, "global")).limit(1);
    if (dbSettings.length > 0) {
      INTERVAL_STEP = (dbSettings[0].value as any).intervalStep || 30;
    }
  } catch (e) {}

  for (const shift of dayShifts) {
    const shiftStart = parse(shift.start, "HH:mm", targetDate);
    const shiftEnd = parse(shift.end, "HH:mm", targetDate);

    let currentSlotStart = shiftStart;

    while (isBefore(currentSlotStart, shiftEnd)) {
      const currentSlotEnd = addMinutes(currentSlotStart, totalRequiredMins);

      // Nếu Slot này vượt qua giờ kết thúc ca làm việc -> Bỏ qua
      if (isAfter(currentSlotEnd, shiftEnd)) {
        break;
      }

      // Slot không được nằm trong quá khứ
      if (isBefore(currentSlotStart, now)) {
        if (includeUnavailable) {
          resultSlots.push({
            startAt: currentSlotStart,
            endAt: currentSlotEnd,
            providerId: provider.id,
            score: -10,
            isAvailable: false,
            unavailableReason: "PAST",
          });
        }
        currentSlotStart = addMinutes(currentSlotStart, INTERVAL_STEP);
        continue;
      }

      // Kiểm tra đụng độ (Conflict)
      if (!isSlotConflict(currentSlotStart, currentSlotEnd, occupiedSlots)) {
        // TÍNH ĐIỂM SLOT (SMART RANKING M12)
        // Ưu tiên slot lấp đầy khoảng trống (đứng ngay trước hoặc ngay sau một lịch bận)
        let score = 0;
        const isTouchingBefore = occupiedSlots.some(occ => isEqual(currentSlotStart, occ.endAt));
        const isTouchingAfter = occupiedSlots.some(occ => isEqual(currentSlotEnd, occ.startAt));

        if (isTouchingBefore || isTouchingAfter) {
          score += 30; // Thưởng điểm vì lấp đầy khoảng trống
        }

        resultSlots.push({
          startAt: currentSlotStart,
          endAt: currentSlotEnd,
          providerId: provider.id,
          score,
          isAvailable: true,
        });
      } else if (includeUnavailable) {
        const matchingOccs = occupiedSlots.filter(occ => isBefore(currentSlotStart, occ.endAt) && isAfter(currentSlotEnd, occ.startAt));
        const hasBooked = matchingOccs.some(o => o.type === "APPOINTMENT");
        const hasHold = matchingOccs.some(o => o.type === "HOLD");
        const unavailableReason = hasBooked ? "BOOKED" : (hasHold ? "HELD" : "BOOKED");

        resultSlots.push({
          startAt: currentSlotStart,
          endAt: currentSlotEnd,
          providerId: provider.id,
          score: -1,
          isAvailable: false,
          unavailableReason,
        });
      }

      // Nhảy sang mốc giờ tiếp theo
      currentSlotStart = addMinutes(currentSlotStart, INTERVAL_STEP);
    }
  }

  // Sắp xếp: Nếu includeUnavailable thì ưu tiên hiển thị theo trình tự thời gian tăng dần
  // để người dùng dễ theo dõi buổi sáng/chiều/tối
  if (includeUnavailable) {
    return resultSlots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  // Sort theo score giảm dần, nếu bằng thì sort theo thời gian tăng dần
  return resultSlots.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) {
      return (b.score || 0) - (a.score || 0);
    }
    return a.startAt.getTime() - b.startAt.getTime();
  });
}
