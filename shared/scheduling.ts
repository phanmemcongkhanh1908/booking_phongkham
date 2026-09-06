import { z } from "zod";

// Các khung giờ làm việc chuẩn (00:00 - 23:59 format HH:mm)
export const TimeSlotSchema = z.object({
  start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Giờ không hợp lệ (HH:mm)"),
  end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Giờ không hợp lệ (HH:mm)"),
});

export const WorkingHoursSchema = z.object({
  monday: z.array(TimeSlotSchema).default([]),
  tuesday: z.array(TimeSlotSchema).default([]),
  wednesday: z.array(TimeSlotSchema).default([]),
  thursday: z.array(TimeSlotSchema).default([]),
  friday: z.array(TimeSlotSchema).default([]),
  saturday: z.array(TimeSlotSchema).default([]),
  sunday: z.array(TimeSlotSchema).default([]),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;
export type WorkingHours = z.infer<typeof WorkingHoursSchema>;

// Kiểu dữ liệu mô tả khoảng thời gian bị chiếm dụng (Occupied)
export interface OccupiedSlot {
  startAt: Date;
  endAt: Date;
  type: "APPOINTMENT" | "HOLD" | "BLOCK";
}

export interface AvailableSlot {
  startAt: Date;
  endAt: Date;
  providerId: string;
  score?: number;
  isAvailable?: boolean;
  unavailableReason?: "BOOKED" | "HELD" | "PAST";
}
