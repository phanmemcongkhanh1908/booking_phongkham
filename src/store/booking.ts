import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PatientDraft {
  bookingFor: 'self' | 'relative';
  fullName: string;
  phone: string;
  email: string;
  telegramId: string;
  notes: string;
}

interface BookingState {
  tenantId: string | null;
  step: number;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  serviceIsFree: boolean | null;
  serviceShowPrice: boolean | null;
  serviceDuration: number | null;
  selectedServices: Array<{
    id: string;
    name: string;
    price?: number | null;
    durationMins?: number | null;
    isFree?: boolean | null;
    showPrice?: boolean | null;
  }>;
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
  announcementBanner: {
    isVisible: boolean;
    message: string;
    type: 'info' | 'warning' | 'success';
  } | null;
  clinicProfile: {
    clinicName?: string;
    name?: string;
    doctorName?: string;
    address?: string;
    phone?: string;
    hotline?: string;
    workingHours?: string;
    workingHoursStr?: string;
    slogan?: string;
    slug?: string;
  } | null;
  bookingFormConfig: {
    uiVersion?: 'full' | 'simple';
    showNotificationChannels?: boolean;
    showHoldCountdown?: boolean;
    quickNotesTags?: string[];
  } | null;
  
  setTenantId: (id: string | null) => void;
  setStep: (step: number) => void;
  setService: (id: string, name: string, price?: number | null, duration?: number | null, isFree?: boolean | null, showPrice?: boolean | null) => void;
  setSelectedServices: (services: Array<{ id: string; name: string; price?: number | null; durationMins?: number | null; isFree?: boolean | null; showPrice?: boolean | null }>) => void;
  toggleServiceItem: (service: { id: string; name: string; price?: number | null; durationMins?: number | null; isFree?: boolean | null; showPrice?: boolean | null }) => void;
  clearHold: () => void;
  setSelectedSlot: (start: string, end: string) => void;
  setDateTimeSlot: (date: string, providerId: string | null, token: string, start: string, end: string, expiresAt: number, providerName?: string | null) => void;
  setPatientDraft: (draft: Partial<PatientDraft>) => void;
  setClinicProfile: (profile: any) => void;
  setBookingFormConfig: (config: any) => void;
  setAnnouncementBanner: (banner: any) => void;
  setAppointmentSuccess: (
    id: string, 
    name: string, 
    phone: string, 
    email?: string | null, 
    telegramId?: string | null,
    botUsername?: string | null,
    extra?: {
      serviceName?: string;
      serviceDuration?: number;
      slotStartTime?: string;
      slotEndTime?: string;
      providerName?: string;
    }
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

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      step: 1,
      serviceId: null,
      serviceName: null,
      servicePrice: null,
      serviceIsFree: null,
      serviceShowPrice: null,
      serviceDuration: null,
      selectedServices: [],
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
      announcementBanner: null,
      clinicProfile: null,
      bookingFormConfig: null,

      setTenantId: (id) => set({ tenantId: id }),
      setStep: (step) => set({ step }),
      setClinicProfile: (profile) => set({ clinicProfile: profile }),
      setBookingFormConfig: (config) => set({ bookingFormConfig: config }),
      setAnnouncementBanner: (banner) => set({ announcementBanner: banner }),
      
      clearHold: () => set({
        sessionToken: null,
        slotStartTime: null,
        slotEndTime: null,
        holdExpiresAt: null,
      }),

      setSelectedSlot: (start, end) => set({
        slotStartTime: start,
        slotEndTime: end,
      }),

      setService: (id, name, price = null, duration = null, isFree = null, showPrice = null) => {
        const currentServiceId = get().serviceId;
        const isDifferent = currentServiceId !== id;
        const singleServiceObj = { id, name, price, durationMins: duration, isFree, showPrice };
        set({ 
          serviceId: id, 
          serviceName: name, 
          servicePrice: price, 
          serviceIsFree: isFree,
          serviceShowPrice: showPrice,
          serviceDuration: duration,
          selectedServices: [singleServiceObj],
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

      setSelectedServices: (servicesList) => {
        if (!servicesList || servicesList.length === 0) {
          set({
            selectedServices: [],
            serviceId: null,
            serviceName: null,
            servicePrice: null,
            serviceDuration: null,
            sessionToken: null,
            slotStartTime: null,
            slotEndTime: null,
            holdExpiresAt: null,
          });
          return;
        }

        const combinedName = servicesList.map(s => s.name).join(' + ');
        const totalDuration = servicesList.reduce((acc, s) => acc + (s.durationMins || 30), 0);
        const totalPrice = servicesList.reduce((acc, s) => acc + (s.price || 0), 0);
        const isFree = servicesList.every(s => s.isFree || s.price === 0);
        const showPrice = servicesList.some(s => s.showPrice);

        set({
          selectedServices: servicesList,
          serviceId: servicesList[0].id,
          serviceName: combinedName,
          servicePrice: totalPrice,
          serviceDuration: totalDuration,
          serviceIsFree: isFree,
          serviceShowPrice: showPrice,
          sessionToken: null,
          slotStartTime: null,
          slotEndTime: null,
          holdExpiresAt: null,
        });
      },

      toggleServiceItem: (svc) => {
        const current = get().selectedServices || [];
        const exists = current.some(s => s.id === svc.id);
        let next: Array<{ id: string; name: string; price?: number | null; durationMins?: number | null; isFree?: boolean | null; showPrice?: boolean | null }>;
        
        if (exists) {
          next = current.filter(s => s.id !== svc.id);
        } else {
          next = [...current, svc];
        }

        if (next.length === 0) {
          set({
            selectedServices: [],
            serviceId: null,
            serviceName: null,
            servicePrice: null,
            serviceDuration: null,
            serviceIsFree: null,
            serviceShowPrice: null,
            sessionToken: null,
            slotStartTime: null,
            slotEndTime: null,
            holdExpiresAt: null,
          });
          return;
        }

        const combinedName = next.map(s => s.name).join(' + ');
        const totalDuration = next.reduce((acc, s) => acc + (s.durationMins || 30), 0);
        const totalPrice = next.reduce((acc, s) => acc + (s.price || 0), 0);
        const isFree = next.every(s => s.isFree || s.price === 0);
        const showPrice = next.some(s => s.showPrice);

        set({
          selectedServices: next,
          serviceId: next[0]?.id || null,
          serviceName: combinedName,
          servicePrice: totalPrice,
          serviceDuration: totalDuration,
          serviceIsFree: isFree,
          serviceShowPrice: showPrice,
          sessionToken: null,
          slotStartTime: null,
          slotEndTime: null,
          holdExpiresAt: null,
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

      setAppointmentSuccess: (id, name, phone, email = null, telegramId = null, botUsername = null, extra) => set((state) => ({
        appointmentId: id,
        patientName: name,
        patientPhone: phone,
        patientEmail: email,
        patientTelegramId: telegramId,
        telegramBotUsername: botUsername,
        step: 5,
        sessionToken: null,
        holdExpiresAt: null,
        ...(extra?.serviceName ? { serviceName: extra.serviceName } : {}),
        ...(extra?.serviceDuration ? { serviceDuration: extra.serviceDuration } : {}),
        ...(extra?.slotStartTime ? { slotStartTime: extra.slotStartTime } : {}),
        ...(extra?.slotEndTime ? { slotEndTime: extra.slotEndTime } : {}),
        ...(extra?.providerName ? { providerName: extra.providerName } : {}),
      })),

      reset: () => set({
        tenantId: null,
        step: 1,
        serviceId: null,
        serviceName: null,
        servicePrice: null,
        serviceIsFree: null,
        serviceShowPrice: null,
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
    }),
    {
      name: 'booking-storage', // name of item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({
        // Keep these in storage
        step: state.step,
        serviceId: state.serviceId,
        serviceName: state.serviceName,
        servicePrice: state.servicePrice,
        serviceIsFree: state.serviceIsFree,
        serviceShowPrice: state.serviceShowPrice,
        serviceDuration: state.serviceDuration,
        providerId: state.providerId,
        providerName: state.providerName,
        selectedDate: state.selectedDate,
        sessionToken: state.sessionToken,
        slotStartTime: state.slotStartTime,
        slotEndTime: state.slotEndTime,
        holdExpiresAt: state.holdExpiresAt,
        patientDraft: state.patientDraft,
        // Do not persist tenantId, clinicProfile, bookingFormConfig, etc. (they should be fetched from URL on reload)
      }),
    }
  )
);
