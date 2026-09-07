import { create } from 'zustand';

export interface PatientDraft {
  bookingFor: 'self' | 'relative';
  fullName: string;
  phone: string;
  email: string;
  telegramId: string;
  notes: string;
}

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
  
  // Patient draft for persistent form state across Back/Forward navigation
  patientDraft: PatientDraft;
  
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
  bookingFormConfig: {
    showNotificationChannels?: boolean;
    showHoldCountdown?: boolean;
    quickNotesTags?: string[];
  } | null;
  
  setStep: (step: number) => void;
  setService: (id: string, name: string, price?: number | null, duration?: number | null) => void;
  clearHold: () => void;
  setDateTimeSlot: (date: string, providerId: string | null, token: string, start: string, end: string, expiresAt: number, providerName?: string | null) => void;
  setPatientDraft: (draft: Partial<PatientDraft>) => void;
  setClinicProfile: (profile: any) => void;
  setBookingFormConfig: (config: any) => void;
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

const initialPatientDraft: PatientDraft = {
  bookingFor: 'self',
  fullName: '',
  phone: '',
  email: '',
  telegramId: '',
  notes: '',
};

export const useBookingStore = create<BookingState>((set, get) => ({
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
  patientDraft: { ...initialPatientDraft },
  appointmentId: null,
  patientName: null,
  patientPhone: null,
  patientEmail: null,
  patientTelegramId: null,
  telegramBotUsername: null,
  clinicProfile: null,
  bookingFormConfig: null,

  setStep: (step) => set({ step }),
  setClinicProfile: (profile) => set({ clinicProfile: profile }),
  setBookingFormConfig: (config) => set({ bookingFormConfig: config }),
  
  clearHold: () => set({
    sessionToken: null,
    slotStartTime: null,
    slotEndTime: null,
    holdExpiresAt: null,
  }),

  setService: (id, name, price = null, duration = null) => {
    const currentServiceId = get().serviceId;
    const isDifferent = currentServiceId !== id;
    set({ 
      serviceId: id, 
      serviceName: name, 
      servicePrice: price, 
      serviceDuration: duration, 
      step: 2,
      // Khi đổi dịch vụ khác, xoá hold cũ tránh lệch serviceId trong appointment
      ...(isDifferent ? {
        sessionToken: null,
        slotStartTime: null,
        slotEndTime: null,
        holdExpiresAt: null,
      } : {})
    });
  },

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

  setPatientDraft: (draft) => set((state) => ({
    patientDraft: {
      ...state.patientDraft,
      ...draft
    }
  })),

  setAppointmentSuccess: (id, name, phone, email = null, telegramId = null, botUsername = null) => set({
    appointmentId: id,
    patientName: name,
    patientPhone: phone,
    patientEmail: email,
    patientTelegramId: telegramId,
    telegramBotUsername: botUsername,
    step: 5
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
    patientDraft: { ...initialPatientDraft },
    appointmentId: null,
    patientName: null,
    patientPhone: null,
    patientEmail: null,
    patientTelegramId: null,
    telegramBotUsername: null
  }),
}));
