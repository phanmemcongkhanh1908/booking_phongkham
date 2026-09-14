import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ServerSpeechEngine } from '../services/speech/ServerSpeechEngine';

export interface BroadcastAppointment {
  id: string;
  patientName: string;
  patientPhone?: string;
  serviceName?: string;
  providerName?: string;
  startAt: string;
  status: string;
  createdAt: string;
  audioUrl?: string;
  reminderCount: number;
  lastAnnouncedAt: number;
  isViewed: boolean;
  isConfirmed: boolean;
  snoozeUntil?: number;
}

export interface BroadcastSettings {
  enabled: boolean;
  autoChime: boolean;
  volume: number;
  reminderIntervalSeconds: number; // 30, 60, 90, 120, 180, 300, or 0 (disabled)
  maxReminders: number; // 1, 3, 5, 10
}

interface BroadcastState extends BroadcastSettings {
  isPlaying: boolean;
  currentPlayingTitle?: string;
  pendingList: BroadcastAppointment[];
  soundUnlocked: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setAutoChime: (autoChime: boolean) => void;
  setVolume: (volume: number) => void;
  setReminderIntervalSeconds: (seconds: number) => void;
  setMaxReminders: (count: number) => void;
  setSoundUnlocked: (unlocked: boolean) => void;
  setIsPlaying: (playing: boolean, title?: string) => void;

  // Queue actions
  handleIncomingBooking: (booking: any) => Promise<void>;
  acknowledgeAppointment: (id: string) => void;
  confirmAppointmentQuick: (id: string, apiInstance: any) => Promise<boolean>;
  snoozeAppointment: (id: string, minutes?: number) => void;
  dismissAppointment: (id: string) => void;
  checkAndTriggerReminders: () => Promise<void>;
  testBroadcast: () => Promise<void>;
}

// Clean text for speech
function formatTimeForSpeech(dateString: string): string {
  try {
    const d = new Date(dateString);
    const h = d.getHours();
    const m = d.getMinutes();
    return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
  } catch {
    return "hôm nay";
  }
}

export const useBroadcastStore = create<BroadcastState>()(
  persist(
    (set, get) => ({
      enabled: true,
      autoChime: true,
      volume: 0.9,
      reminderIntervalSeconds: 60, // Default 60 seconds reminder interval
      maxReminders: 5,
      isPlaying: false,
      currentPlayingTitle: undefined,
      pendingList: [],
      soundUnlocked: false,

      setEnabled: (enabled) => set({ enabled }),
      setAutoChime: (autoChime) => set({ autoChime }),
      setVolume: (volume) => set({ volume }),
      setReminderIntervalSeconds: (reminderIntervalSeconds) => set({ reminderIntervalSeconds }),
      setMaxReminders: (maxReminders) => set({ maxReminders }),
      setSoundUnlocked: (soundUnlocked) => set({ soundUnlocked }),
      setIsPlaying: (isPlaying, currentPlayingTitle) => set({ isPlaying, currentPlayingTitle }),

      handleIncomingBooking: async (booking: any) => {
        const state = get();
        if (!booking || !booking.id) return;

        // Skip if already in pending list
        const existing = state.pendingList.find(p => p.id === booking.id);
        if (existing) return;

        const isUnconfirmed = booking.status === 'REQUESTED' || booking.status === 'PENDING';
        
        const newAppt: BroadcastAppointment = {
          id: booking.id,
          patientName: booking.patientName || 'Khách hàng',
          patientPhone: booking.patientPhone || '',
          serviceName: booking.serviceName || 'Dịch vụ nha khoa',
          providerName: booking.providerName || '',
          startAt: booking.startAt || new Date().toISOString(),
          status: booking.status || 'REQUESTED',
          createdAt: booking.createdAt || new Date().toISOString(),
          audioUrl: booking.audioUrl,
          reminderCount: 0,
          lastAnnouncedAt: Date.now(),
          isViewed: false,
          isConfirmed: booking.status === 'CONFIRMED',
        };

        // If unconfirmed, add to pending list for tracking & auto-reminder
        if (isUnconfirmed) {
          set((prev) => ({
            pendingList: [newAppt, ...prev.pendingList.filter(p => p.id !== booking.id)]
          }));
        }

        // Show System Desktop Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const timeStr = formatTimeForSpeech(newAppt.startAt);
          try {
            new Notification('🔔 LỊCH HẸN MỚI ĐẶT TẠI PHÒNG KHÁM', {
              body: `Khách hàng: ${newAppt.patientName}\nDịch vụ: ${newAppt.serviceName}\nThời gian hẹn: ${timeStr}`,
              icon: '/pwa-192x192.png',
              tag: `booking-${newAppt.id}`,
              requireInteraction: true
            });
          } catch (e) {
            console.warn("Notification error:", e);
          }
        }

        // Speak Voice Announcement
        if (state.enabled) {
          const timeStr = formatTimeForSpeech(newAppt.startAt);
          const speechText = `Thông báo: Có khách hàng mới đặt lịch. Khách hàng ${newAppt.patientName}. Dịch vụ ${newAppt.serviceName}. Thời gian hẹn ${timeStr}.`;
          
          set({ isPlaying: true, currentPlayingTitle: `Lịch mới: ${newAppt.patientName}` });
          try {
            await ServerSpeechEngine.speak(speechText, newAppt.audioUrl);
          } finally {
            set({ isPlaying: false, currentPlayingTitle: undefined });
          }
        }
      },

      acknowledgeAppointment: (id: string) => {
        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === id ? { ...p, isViewed: true } : p
          )
        }));
      },

      confirmAppointmentQuick: async (id: string, apiInstance: any) => {
        try {
          // Send update to server
          await apiInstance.patch(`/appointments/${id}/status`, { status: 'CONFIRMED' });
          // Remove from pending list immediately
          set((prev) => ({
            pendingList: prev.pendingList.filter((p) => p.id !== id)
          }));
          return true;
        } catch (e) {
          console.error("Failed to confirm appointment", e);
          return false;
        }
      },

      snoozeAppointment: (id: string, minutes: number = 2) => {
        const snoozeUntil = Date.now() + minutes * 60 * 1000;
        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === id ? { ...p, snoozeUntil } : p
          )
        }));
      },

      dismissAppointment: (id: string) => {
        set((prev) => ({
          pendingList: prev.pendingList.filter((p) => p.id !== id)
        }));
      },

      checkAndTriggerReminders: async () => {
        const state = get();
        if (!state.enabled || state.reminderIntervalSeconds <= 0) return;
        if (state.isPlaying) return; // Don't interrupt active speech

        const now = Date.now();
        const intervalMs = state.reminderIntervalSeconds * 1000;

        // Find candidate for reminder:
        // Must be unconfirmed, not currently snoozed, not viewed, and time elapsed >= interval
        const candidates = state.pendingList.filter((item) => {
          if (item.isConfirmed || item.status === 'CONFIRMED' || item.status === 'CANCELLED') return false;
          if (item.isViewed) return false;
          if (item.snoozeUntil && now < item.snoozeUntil) return false;
          if (item.reminderCount >= state.maxReminders) return false;
          return now - item.lastAnnouncedAt >= intervalMs;
        });

        if (candidates.length === 0) return;

        // Pick the oldest unhandled appointment
        const target = candidates[0];
        const nextReminderCount = target.reminderCount + 1;

        // Update target in store
        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === target.id
              ? {
                  ...p,
                  reminderCount: nextReminderCount,
                  lastAnnouncedAt: now
                }
              : p
          )
        }));

        // Send Desktop Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`⚠️ NHẮC NHỞ CHƯA XỬ LÝ (LẦN ${nextReminderCount})`, {
              body: `Khách hàng: ${target.patientName}\nDịch vụ: ${target.serviceName}\nLịch hẹn chưa được xác nhận, quản lý vui lòng chốt lịch!`,
              icon: '/pwa-192x192.png',
              tag: `reminder-${target.id}-${nextReminderCount}`,
              requireInteraction: true
            });
          } catch {}
        }

        // Play professional announcement with reminder text
        const timeStr = formatTimeForSpeech(target.startAt);
        const reminderText = `Nhắc nhở lần ${nextReminderCount}: Lịch hẹn của khách hàng ${target.patientName}, đặt dịch vụ ${target.serviceName} lúc ${timeStr} chưa được chốt lịch. Quản lý phòng khám vui lòng kiểm tra và xử lý ngay!`;

        set({
          isPlaying: true,
          currentPlayingTitle: `Nhắc nhở (${nextReminderCount}): ${target.patientName}`
        });

        try {
          await ServerSpeechEngine.speak(reminderText);
        } finally {
          set({ isPlaying: false, currentPlayingTitle: undefined });
        }
      },

      testBroadcast: async () => {
        const state = get();
        ServerSpeechEngine.unlockAudio();
        set({ soundUnlocked: true, isPlaying: true, currentPlayingTitle: "Đang phát thanh thử nghiệm..." });

        const testText = "Thông báo: Hệ thống phát thanh thông báo phòng khám đang hoạt động tiêu chuẩn. Nhạc hiệu và giọng đọc tiếng Việt rõ ràng, sẵn sàng phục vụ!";
        try {
          await ServerSpeechEngine.speak(testText);
        } finally {
          set({ isPlaying: false, currentPlayingTitle: undefined });
        }
      }
    }),
    {
      name: 'dental-broadcast-settings',
      partialize: (state) => ({
        enabled: state.enabled,
        autoChime: state.autoChime,
        volume: state.volume,
        reminderIntervalSeconds: state.reminderIntervalSeconds,
        maxReminders: state.maxReminders
      })
    }
  )
);
