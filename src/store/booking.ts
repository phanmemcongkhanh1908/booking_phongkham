import { create } from 'zustand';

interface BookingState {
  step: number;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  serviceDuration: number | null;
  providerId: string | null;
  providerName: string | null;
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
  clinicProfile: {
    clinicName?: string;
    doctorName?: string;
    address?: string;
    phone?: string;
    workingHours?: string;
    slogan?: string;
  } | null;
  
  setStep: (step: number) => void;
  setService: (id: string, name: string, price?: number | null, duration?: number | null) => void;
  setDateTimeSlot: (date: string, providerId: string | null, token: string, start: string, end: string, expiresAt: number, providerName?: string | null) => void;
  setClinicProfile: (profile: any) => void;
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
  servicePrice: null,
  serviceDuration: null,
  providerId: null,
  providerName: null,
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
  clinicProfile: null,

  setStep: (step) => set({ step }),
  setClinicProfile: (profile) => set({ clinicProfile: profile }),
  setService: (id, name, price = null, duration = null) => set({ 
    serviceId: id, 
    serviceName: name, 
    servicePrice: price, 
    serviceDuration: duration, 
    step: 2 
  }),
  setDateTimeSlot: (date, providerId, token, start, end, expiresAt, providerName = null) => set({
    holdExpiresAt: expiresAt, 
    selectedDate: date, 
    providerId, 
    providerName,
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
    servicePrice: null,
    serviceDuration: null,
    providerId: null,
    providerName: null,
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
