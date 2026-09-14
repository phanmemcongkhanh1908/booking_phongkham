import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { useBroadcastStore } from '../store/broadcastStore';
import { formatVietnameseTime, formatVietnameseDate } from '../services/speech/VietnameseSpeechFormatter';
import { useLocation } from 'react-router-dom';

export function useRealtimeBooking() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const processedEvents = useRef<Set<string>>(new Set());
  const location = useLocation();

  useEffect(() => {
    // Check role and route to ensure administrative access and appropriate context
    if (!token || !user) return;
    if (!location.pathname.startsWith('/admin')) return;
    
    const roleUpper = (user.role || '').toUpperCase();
    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'DENTIST', 'DOCTOR', 'STAFF', 'MANAGER'].some(r => roleUpper.includes(r));
    if (!isStaff) return;

    let es: EventSource | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      es = new EventSource(`/api/notifications/stream?token=${token}`);

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'HEARTBEAT') return;
        } catch (err) {}
      };

      es.addEventListener('BOOKING_CREATED', async (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (!payload || !payload.id) return;

          // Deduplication check
          const eventId = `BOOKING_${payload.id}`;
          if (processedEvents.current.has(eventId)) return;
          processedEvents.current.add(eventId);

          // 1. Toast UI notification
          const time = formatVietnameseTime(payload.startAt);
          const date = formatVietnameseDate(payload.startAt);
          toast.success(`Khách hàng mới: ${payload.patientName || 'Khách hàng'}\n${payload.serviceName || 'Dịch vụ nha khoa'}\n${time} - ${date}`, {
            duration: 8000,
            icon: '🔔'
          });

          // 2. Dispatch to Broadcast Store (Handles Professional Chime + Vietnamese TTS + Reminder Loop)
          await useBroadcastStore.getState().handleIncomingBooking(payload);

        } catch (err) {
          console.error("Failed to parse BOOKING_CREATED", err);
        }
      });

      es.onerror = () => {
        es?.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [token, user, location.pathname]);
}
