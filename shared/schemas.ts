import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(6, { message: "Mật khẩu phải chứa ít nhất 6 ký tự" }),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

export const HoldSlotSchema = z.object({
  providerId: z.string().uuid("ID Bác sĩ không hợp lệ"),
  serviceId: z.string().uuid("ID Dịch vụ không hợp lệ"),
  startAt: z.string().datetime({ message: "Giờ bắt đầu không hợp lệ (ISO 8601)" }),
  endAt: z.string().datetime({ message: "Giờ kết thúc không hợp lệ (ISO 8601)" }),
});

export type HoldSlotRequest = z.infer<typeof HoldSlotSchema>;

export const BookAppointmentSchema = z.object({
  sessionToken: z.string().min(1, "Thiếu Session Token"),
  fullName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  phone: z.string().regex(/^(0|\+84)[0-9]{8,10}$/, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  telegramId: z.string().optional().or(z.literal("")),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải là YYYY-MM-DD").optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  notes: z.string().optional(),
});

export type BookAppointmentRequest = z.infer<typeof BookAppointmentSchema>;
