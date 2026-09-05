import { create } from 'zustand';

interface BookingState {
  step: number;
  serviceId: string | null;
  serviceName: string | null;
  providerId: string | null;
  selectedDate: string | null;
  sessionToken: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  holdExpiresAt: number | null;
  
  // Success info
  appointmentId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  patientTelegramId: string | null;
  telegramBotUsername: string | null;
  
  setStep: (step: number) => void;
  setService: (id: string, name: string) => void;
  setDateTimeSlot: (date: string, providerId: string | null, token: string, start: string, end: string, expiresAt: number) => void;
  setAppointmentSuccess: (
    id: string, 
    name: string, 
    phone: string, 
    email?: string | null, 
    telegramId?: string | null,
    botUsername?: string | null
  ) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  step: 1,
  serviceId: null,
  serviceName: null,
  providerId: null,
  selectedDate: null,
  sessionToken: null,
  slotStartTime: null,
  slotEndTime: null,
  holdExpiresAt: null,
  appointmentId: null,
  patientName: null,
  patientPhone: null,
  patientEmail: null,
  patientTelegramId: null,
  telegramBotUsername: null,

  setStep: (step) => set({ step }),
  setService: (id, name) => set({ serviceId: id, serviceName: name, step: 2 }),
  setDateTimeSlot: (date, providerId, token, start, end, expiresAt) => set({
    holdExpiresAt: expiresAt, 
    selectedDate: date, 
    providerId, 
    sessionToken: token, 
    slotStartTime: start,
    slotEndTime: end,
    step: 3 
  }),
  setAppointmentSuccess: (id, name, phone, email = null, telegramId = null, botUsername = null) => set({
    appointmentId: id,
    patientName: name,
    patientPhone: phone,
    patientEmail: email,
    patientTelegramId: telegramId,
    telegramBotUsername: botUsername,
    step: 4
  }),
  reset: () => set({
    step: 1,
    serviceId: null,
    serviceName: null,
    providerId: null,
    selectedDate: null,
    sessionToken: null,
    slotStartTime: null,
    slotEndTime: null,
  holdExpiresAt: null,
    appointmentId: null,
    patientName: null,
    patientPhone: null,
    patientEmail: null,
    patientTelegramId: null,
    telegramBotUsername: null
  }),
}));
