import { z } from "zod";

export const AppointmentQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").optional(),
  providerId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum([
    "REQUESTED",
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_SERVICE",
    "COMPLETED",
    "CANCEL_PATIENT",
    "CANCEL_CLINIC",
    "RESCHEDULED",
    "NO_SHOW",
    "WAITLIST"
  ]),
});

export type AppointmentQueryRequest = z.infer<typeof AppointmentQuerySchema>;
export type UpdateStatusRequest = z.infer<typeof UpdateStatusSchema>;
