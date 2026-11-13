import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ServerSpeechEngine } from '../services/speech/ServerSpeechEngine';
import { TTSQueueManager } from '../services/speech/TTSQueueManager';
import { useAuthStore } from './auth';
import { useVoiceStore } from './voiceStore';
import { formatVietnameseDate, formatVietnameseTime } from '../services/speech/VietnameseSpeechFormatter';

export function normalizeTenantId(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface BroadcastAppointment {
  id: string;
  tenantId?: string | null;
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
  mobilePopupEnabled: boolean;
  mobileVibrateEnabled: boolean;
  volume: number;
  reminderIntervalSeconds: number; // 30, 60, 90, 120, 180, 300, or 0 (disabled)
  maxReminders: number; // 1, 3, 5, 10
}

interface BroadcastState extends BroadcastSettings {
  isPlaying: boolean;
  currentPlayingTitle?: string;
  queueLength: number;
  autoplayBlocked: boolean;
  pendingList: BroadcastAppointment[];
  activePopupId: string | null;
  soundUnlocked: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setAutoChime: (autoChime: boolean) => void;
  setMobilePopupEnabled: (enabled: boolean) => void;
  setMobileVibrateEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setReminderIntervalSeconds: (seconds: number) => void;
  setMaxReminders: (count: number) => void;
  setSoundUnlocked: (unlocked: boolean) => void;
  setIsPlaying: (playing: boolean, title?: string) => void;
  openPopup: (id: string) => void;
  closePopup: () => void;
  unlockSoundAndRetry: () => void;
  stopAllPlayback: () => void;
  clearForTenantSwitch: () => void;

  // Queue actions
  handleIncomingBooking: (booking: any, options?: { forcePopup?: boolean }) => Promise<void>;
  ensurePopupForAppointmentId: (id: string, apiInstance: any) => Promise<void>;
  acknowledgeAppointment: (id: string) => void;
  confirmAppointmentQuick: (id: string, apiInstance: any) => Promise<boolean>;
  snoozeAppointment: (id: string, minutes?: number) => void;
  dismissAppointment: (id: string) => void;
  checkAndTriggerReminders: () => Promise<void>;
  testBroadcast: (options?: { withPopup?: boolean }) => Promise<void>;
}

function formatTimeForSpeech(dateString: string): string {
  return formatVietnameseTime(dateString) || 'hôm nay';
}

function buildBookingAnnouncementText(appt: BroadcastAppointment): string {
  const timeStr = formatTimeForSpeech(appt.startAt);
  const dateStr = formatVietnameseDate(appt.startAt);
  const doctorPart = appt.providerName ? ` Bác sĩ ${appt.providerName}.` : '';
  const datePart = dateStr ? `, ${dateStr}` : '';
  return `Thông báo: Có khách hàng mới đặt lịch. Khách hàng ${appt.patientName}. Dịch vụ ${appt.serviceName}.${doctorPart} Thời gian hẹn ${timeStr}${datePart}.`;
}

export const useBroadcastStore = create<BroadcastState>()(
  persist(
    (set, get) => ({
      enabled: true,
      autoChime: true,
      mobilePopupEnabled: true,
      mobileVibrateEnabled: true,
      volume: 0.9,
      reminderIntervalSeconds: 60,
      maxReminders: 5,
      isPlaying: false,
      currentPlayingTitle: undefined,
      queueLength: 0,
      autoplayBlocked: false,
      pendingList: [],
      activePopupId: null,
      soundUnlocked: false,

      setEnabled: (enabled) => {
        if (!enabled) {
          TTSQueueManager.clear();
        }
        useVoiceStore.getState().setEnabled(enabled);
        set({ enabled });
      },
      setAutoChime: (autoChime) => set({ autoChime }),
      setMobilePopupEnabled: (mobilePopupEnabled) => set({ mobilePopupEnabled }),
      setMobileVibrateEnabled: (mobileVibrateEnabled) => set({ mobileVibrateEnabled }),
      setVolume: (volume) => {
        useVoiceStore.getState().setVolume(volume);
        set({ volume });
      },
      setReminderIntervalSeconds: (reminderIntervalSeconds) => set({ reminderIntervalSeconds }),
      setMaxReminders: (maxReminders) => set({ maxReminders }),
      setSoundUnlocked: (soundUnlocked) => set({ soundUnlocked }),
      setIsPlaying: (isPlaying, currentPlayingTitle) => set({ isPlaying, currentPlayingTitle }),
      openPopup: (id) => set({ activePopupId: id }),
      closePopup: () => set({ activePopupId: null }),

      unlockSoundAndRetry: () => {
        ServerSpeechEngine.unlockAudio();
        TTSQueueManager.clearAutoplayBlocked();
        const state = get();
        const myTenantId = normalizeTenantId(useAuthStore.getState().user?.tenantId);
        const pendingItem = state.pendingList.find(
          (item) =>
            normalizeTenantId(item.tenantId) === myTenantId &&
            !item.isConfirmed &&
            !item.isViewed &&
            item.status !== 'CONFIRMED' &&
            item.status !== 'CANCELLED'
        );
        set({ soundUnlocked: true, autoplayBlocked: false });
        if (pendingItem && state.enabled && useVoiceStore.getState().enabled) {
          TTSQueueManager.enqueue({
            id: `unlock-replay-${pendingItem.id}-${Date.now()}`,
            title: `Lịch mới: ${pendingItem.patientName}`,
            text: buildBookingAnnouncementText(pendingItem),
            audioUrl: pendingItem.audioUrl,
            playChime: state.autoChime,
            source: 'booking',
          });
        }
      },

      stopAllPlayback: () => {
        TTSQueueManager.clear();
        set({ isPlaying: false, currentPlayingTitle: undefined, queueLength: 0 });
      },

      clearForTenantSwitch: () => {
        TTSQueueManager.clear();
        set({
          pendingList: [],
          activePopupId: null,
          isPlaying: false,
          currentPlayingTitle: undefined,
          queueLength: 0,
          autoplayBlocked: false,
        });
      },

      handleIncomingBooking: async (booking: any, options?: { forcePopup?: boolean }) => {
        const state = get();
        if (!booking || !booking.id) return;

        // STRICT TENANT ISOLATION CHECK:
        // Only notify if booking belongs to the exact currently logged-in clinic tenant (or both are root/null).
        const authState = useAuthStore.getState();
        if (!authState.token || !authState.user) return;
        const currentTenantId = normalizeTenantId(authState.user?.tenantId);
        const bookingTenantId = normalizeTenantId(booking.tenantId);
        if (currentTenantId !== bookingTenantId) {
          return;
        }

        // Skip duplicate enqueue if already tracked
        const existing = state.pendingList.find((p) => p.id === booking.id);
        if (existing) {
          if (options?.forcePopup) {
            set({ activePopupId: booking.id });
          }
          return;
        }

        const isUnconfirmed = booking.status === 'REQUESTED' || booking.status === 'PENDING';

        const newAppt: BroadcastAppointment = {
          id: booking.id,
          tenantId: bookingTenantId,
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

        if (isUnconfirmed) {
          const shouldOpenPopup = Boolean(options?.forcePopup || state.mobilePopupEnabled);
          set((prev) => ({
            pendingList: [newAppt, ...prev.pendingList.filter((p) => p.id !== booking.id)],
            activePopupId: shouldOpenPopup ? booking.id : prev.activePopupId,
          }));

          // Trigger gentle vibration alert on Android phones when enabled
          if (
            state.mobileVibrateEnabled &&
            typeof navigator !== 'undefined' &&
            typeof navigator.vibrate === 'function'
          ) {
            try {
              navigator.vibrate([220, 100, 220]);
            } catch {}
          }
        }

        // Show System Desktop Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const timeStr = formatTimeForSpeech(newAppt.startAt);
          try {
            new Notification('🔔 LỊCH HẸN MỚI ĐẶT TẠI PHÒNG KHÁM', {
              body: `Khách hàng: ${newAppt.patientName}\nDịch vụ: ${newAppt.serviceName}\nThời gian hẹn: ${timeStr}`,
              icon: '/pwa-192x192.png',
              tag: `booking-${newAppt.id}`,
              requireInteraction: true,
            });
          } catch (e) {
            console.warn('Notification error:', e);
          }
        }

        // Enqueue into strict sequential audio queue (Chime -> Vietnamese Voice)
        const voiceEnabled = state.enabled && useVoiceStore.getState().enabled;
        if (voiceEnabled) {
          const speechText = buildBookingAnnouncementText(newAppt);
          TTSQueueManager.enqueue({
            id: `booking-${newAppt.id}`,
            title: `Lịch mới: ${newAppt.patientName}`,
            text: speechText,
            audioUrl: newAppt.audioUrl,
            playChime: state.autoChime,
            source: 'booking',
          });
        }
      },

      ensurePopupForAppointmentId: async (id: string, apiInstance: any) => {
        if (!id) return;
        const state = get();
        const authState = useAuthStore.getState();
        const myTenantId = normalizeTenantId(authState.user?.tenantId);
        const existing = state.pendingList.find((p) => p.id === id);
        if (existing && normalizeTenantId(existing.tenantId) === myTenantId) {
          set({ activePopupId: id });
          return;
        }
        try {
          const res = await apiInstance.get('/appointments');
          if (res.data?.success && Array.isArray(res.data.data)) {
            const match = res.data.data.find(
              (a: any) => a.id === id && normalizeTenantId(a.tenantId) === myTenantId
            );
            if (match) {
              await get().handleIncomingBooking(match, { forcePopup: true });
            }
          }
        } catch {}
      },

      acknowledgeAppointment: (id: string) => {
        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === id ? { ...p, isViewed: true } : p
          ),
          activePopupId: prev.activePopupId === id ? null : prev.activePopupId,
        }));
      },

      confirmAppointmentQuick: async (id: string, apiInstance: any) => {
        try {
          await apiInstance.patch(`/appointments/${id}/status`, { status: 'CONFIRMED' });
          set((prev) => ({
            pendingList: prev.pendingList.filter((p) => p.id !== id),
            activePopupId: prev.activePopupId === id ? null : prev.activePopupId,
          }));
          return true;
        } catch (e) {
          console.error('Failed to confirm appointment', e);
          return false;
        }
      },

      snoozeAppointment: (id: string, minutes: number = 2) => {
        const snoozeUntil = Date.now() + minutes * 60 * 1000;
        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === id ? { ...p, snoozeUntil } : p
          ),
          activePopupId: prev.activePopupId === id ? null : prev.activePopupId,
        }));
      },

      dismissAppointment: (id: string) => {
        set((prev) => ({
          pendingList: prev.pendingList.filter((p) => p.id !== id),
          activePopupId: prev.activePopupId === id ? null : prev.activePopupId,
        }));
      },

      checkAndTriggerReminders: async () => {
        const state = get();
        const voiceEnabled = state.enabled && useVoiceStore.getState().enabled;
        if (!voiceEnabled || state.reminderIntervalSeconds <= 0) return;

        // Avoid interrupting or flooding queue while playback is busy
        const qState = TTSQueueManager.getPlaybackState();
        if (qState.isPlaying || qState.queueLength > 0) return;

        const authState = useAuthStore.getState();
        if (!authState.token || !authState.user) return;
        const currentTenantId = normalizeTenantId(authState.user?.tenantId);

        const now = Date.now();
        const intervalMs = state.reminderIntervalSeconds * 1000;

        const candidates = state.pendingList.filter((item) => {
          if (normalizeTenantId(item.tenantId) !== currentTenantId) return false;
          if (item.isConfirmed || item.status === 'CONFIRMED' || item.status === 'CANCELLED') return false;
          if (item.isViewed) return false;
          if (item.snoozeUntil && now < item.snoozeUntil) return false;
          if (item.reminderCount >= state.maxReminders) return false;
          return now - item.lastAnnouncedAt >= intervalMs;
        });

        if (candidates.length === 0) return;

        const target = candidates[0];
        const nextReminderCount = target.reminderCount + 1;

        set((prev) => ({
          pendingList: prev.pendingList.map((p) =>
            p.id === target.id
              ? {
                  ...p,
                  reminderCount: nextReminderCount,
                  lastAnnouncedAt: now,
                }
              : p
          ),
        }));

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`⚠️ NHẮC NHỞ CHƯA XỬ LÝ (LẦN ${nextReminderCount})`, {
              body: `Khách hàng: ${target.patientName}\nDịch vụ: ${target.serviceName}\nLịch hẹn chưa được xác nhận, quản lý vui lòng chốt lịch!`,
              icon: '/pwa-192x192.png',
              tag: `reminder-${target.id}-${nextReminderCount}`,
              requireInteraction: true,
            });
          } catch {}
        }

        const timeStr = formatTimeForSpeech(target.startAt);
        const reminderText = `Nhắc nhở lần ${nextReminderCount}: Lịch hẹn của khách hàng ${target.patientName}, đặt dịch vụ ${target.serviceName} lúc ${timeStr} chưa được chốt lịch. Quản lý phòng khám vui lòng kiểm tra và xử lý ngay!`;

        TTSQueueManager.enqueue({
          id: `reminder-${target.id}-${nextReminderCount}`,
          title: `Nhắc nhở (${nextReminderCount}): ${target.patientName}`,
          text: reminderText,
          playChime: state.autoChime,
          source: 'reminder',
        });
      },

      testBroadcast: async (options?: { withPopup?: boolean }) => {
        const state = get();
        ServerSpeechEngine.unlockAudio();
        TTSQueueManager.clearAutoplayBlocked();
        set({ soundUnlocked: true, autoplayBlocked: false });

        if (options?.withPopup) {
          const authState = useAuthStore.getState();
          const myTenantId = normalizeTenantId(authState.user?.tenantId);
          const demoId = 'demo-mobile-popup';
          const demoAppt: BroadcastAppointment = {
            id: demoId,
            tenantId: myTenantId,
            patientName: 'Nguyễn Minh Anh (Thử nghiệm)',
            patientPhone: '0909123456',
            serviceName: 'Khám răng tổng quát & Tư vấn',
            providerName: 'BS. Chuyên khoa',
            startAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
            status: 'REQUESTED',
            createdAt: new Date().toISOString(),
            reminderCount: 0,
            lastAnnouncedAt: Date.now(),
            isViewed: false,
            isConfirmed: false,
          };
          set((prev) => ({
            pendingList: [demoAppt, ...prev.pendingList.filter((p) => p.id !== demoId)],
            activePopupId: demoId,
          }));
          if (
            state.mobileVibrateEnabled &&
            typeof navigator !== 'undefined' &&
            typeof navigator.vibrate === 'function'
          ) {
            try {
              navigator.vibrate([220, 100, 220]);
            } catch {}
          }
        }

        if (state.enabled && useVoiceStore.getState().enabled) {
          const testText =
            'Thông báo: Hệ thống phát thanh thông báo phòng khám đang hoạt động tiêu chuẩn. Nhạc hiệu và giọng đọc tiếng Việt rõ ràng, sẵn sàng phục vụ!';
          TTSQueueManager.enqueue({
            id: `test-broadcast-${Date.now()}`,
            title: 'Đang phát thanh thử nghiệm...',
            text: testText,
            playChime: state.autoChime,
            source: 'test',
          });
        }
      },
    }),
    {
      name: 'dental-broadcast-settings',
      partialize: (state) => ({
        enabled: state.enabled,
        autoChime: state.autoChime,
        mobilePopupEnabled: state.mobilePopupEnabled,
        mobileVibrateEnabled: state.mobileVibrateEnabled,
        volume: state.volume,
        reminderIntervalSeconds: state.reminderIntervalSeconds,
        maxReminders: state.maxReminders,
      }),
    }
  )
);

// Sync queue playback status & unlock state into Zustand store
if (typeof window !== 'undefined') {
  TTSQueueManager.subscribe((qState) => {
    useBroadcastStore.setState({
      isPlaying: qState.isPlaying,
      currentPlayingTitle: qState.currentPlayingTitle,
      queueLength: qState.queueLength,
      autoplayBlocked: qState.autoplayBlocked,
    });
  });

  ServerSpeechEngine.onUnlockChange((unlocked) => {
    useBroadcastStore.setState({
      soundUnlocked: unlocked,
      ...(unlocked ? { autoplayBlocked: false } : {}),
    });
  });

  // Automatically clear notifications & stop playback when logging out or switching tenant accounts
  useAuthStore.subscribe((state, prevState) => {
    const prevTenant = normalizeTenantId(prevState?.user?.tenantId);
    const nextTenant = normalizeTenantId(state?.user?.tenantId);
    const prevUserId = prevState?.user?.id || null;
    const nextUserId = state?.user?.id || null;
    if (!state.token || prevTenant !== nextTenant || prevUserId !== nextUserId) {
      useBroadcastStore.getState().clearForTenantSwitch();
    }
  });
}
