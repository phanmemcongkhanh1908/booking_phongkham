import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { formatBookingSpeech } from '../services/speech/VietnameseSpeechFormatter';
import { TTSQueueManager } from '../services/speech/TTSQueueManager';
import { formatVietnameseTime, formatVietnameseDate } from '../services/speech/VietnameseSpeechFormatter';

export function useRealtimeBooking() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only connect if admin/receptionist
    if (!token || !user) return;
    if (!['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'DENTIST'].includes(user.role)) return;

    // Use token in query string since EventSource doesn't support headers natively easily
    // Or we just fetch via a polyfill. The simplest way in many Vite apps without exposing token in URL
    // is to use `fetch-event-source` or similar. But since we need vanilla EventSource, passing a short-lived token or ignoring standard EventSource and using a generic approach is needed.
    // Let's pass token in URL for this isolated internal admin UI.
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

      es.addEventListener('BOOKING_CREATED', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          
          // Deduplication
          const eventId = `BOOKING_CREATED_${payload.id}`;
          if (processedEvents.current.has(eventId)) return;
          processedEvents.current.add(eventId);

          // 1. Toast UI
          const time = formatVietnameseTime(payload.startAt);
          const date = formatVietnameseDate(payload.startAt);
          toast.success(`Khách hàng mới: ${payload.patientName}\n${payload.serviceName}\n${time} - ${date}`, {
            duration: 10000,
            icon: '🔔'
          });

          // 2. TTS Voice Notification
          const speechText = formatBookingSpeech(payload);
          TTSQueueManager.enqueue(eventId, speechText, payload.audioUrl);
          
        } catch (err) {
          console.error("Failed to parse BOOKING_CREATED", err);
        }
      });

      es.onerror = () => {
        es?.close();
        // Reconnect after 5s
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimeout);
      TTSQueueManager.clear(); // clear on unmount
    };
  }, [token, user]);
}
