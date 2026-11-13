import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { useBroadcastStore, normalizeTenantId } from '../store/broadcastStore';
import { formatVietnameseTime, formatVietnameseDate } from '../services/speech/VietnameseSpeechFormatter';
import { useLocation } from 'react-router-dom';

export function useRealtimeBooking() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const processedEvents = useRef<Set<string>>(new Set());
  const location = useLocation();

  useEffect(() => {
    if (!token || !user) return;
    if (!location.pathname.startsWith('/admin')) return;
    if (location.pathname === '/admin/login') return;

    const roleUpper = (user.role || '').toUpperCase();
    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'DENTIST', 'DOCTOR', 'STAFF', 'MANAGER'].some((r) =>
      roleUpper.includes(r)
    );
    if (!isStaff) return;

    let es: EventSource | null = null;
    let reconnectTimeout: any;
    let retryCount = 0;

    const connect = () => {
      if (location.pathname === '/admin/login') return;

      try {
        es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

        es.onopen = () => {
          retryCount = 0;
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'HEARTBEAT') return;
          } catch {}
        };

        es.addEventListener('BOOKING_CREATED', async (e: any) => {
          try {
            const payload = JSON.parse(e.data);
            if (!payload || !payload.id) return;
            if (payload.action === 'cancel' || payload.action === 'reschedule') return;

            // Strict normalized tenant isolation check
            const currentTenantId = normalizeTenantId(user?.tenantId);
            const payloadTenantId = normalizeTenantId(payload.tenantId);
            if (currentTenantId !== payloadTenantId) {
              return;
            }

            // Deduplication check
            const eventId = `BOOKING_${payload.id}`;
            if (processedEvents.current.has(eventId)) return;
            processedEvents.current.add(eventId);

            // 1. Toast UI notification
            const time = formatVietnameseTime(payload.startAt);
            const date = formatVietnameseDate(payload.startAt);
            toast.success(
              `Khách hàng mới: ${payload.patientName || 'Khách hàng'}\n${payload.serviceName || 'Dịch vụ nha khoa'}\n${time} - ${date}`,
              {
                duration: 8000,
                icon: '🔔',
              }
            );

            // 2. Dispatch to Broadcast Store (Enqueues Chime + Vietnamese TTS + Reminder Loop)
            await useBroadcastStore.getState().handleIncomingBooking(payload);
          } catch (err) {
            console.error('Failed to parse BOOKING_CREATED', err);
          }
        });

        es.addEventListener('BOOKING_UPDATED', (e: any) => {
          try {
            const payload = JSON.parse(e.data);
            if (!payload || !payload.id) return;

            const currentTenantId = normalizeTenantId(user?.tenantId);
            const payloadTenantId = normalizeTenantId(payload.tenantId);
            if (currentTenantId !== payloadTenantId) {
              return;
            }

            if (payload.action === 'cancel') {
              useBroadcastStore.getState().dismissAppointment(payload.id);
              toast(`Khách hàng ${payload.patientName || ''} đã hủy lịch hẹn.`, {
                icon: 'ℹ️',
                duration: 5000,
              });
            } else if (payload.action === 'reschedule') {
              const time = formatVietnameseTime(payload.startAt);
              toast(`Khách hàng ${payload.patientName || ''} đã đổi giờ hẹn sang ${time}.`, {
                icon: '🗓️',
                duration: 6000,
              });
            }
          } catch {}
        });

        es.onerror = () => {
          es?.close();
          es = null;
          retryCount++;
          const delay = retryCount <= 1 ? 15000 : retryCount === 2 ? 30000 : 60000;
          reconnectTimeout = setTimeout(() => {
            if (document.visibilityState !== 'hidden') {
              connect();
            }
          }, delay);
        };
      } catch {
        retryCount++;
        reconnectTimeout = setTimeout(connect, 30000);
      }
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [token, user?.id, user?.tenantId, user?.role, location.pathname]);
}
