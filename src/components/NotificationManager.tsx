import React, { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { differenceInMinutes, parseISO } from 'date-fns';
import api from '../services/api';
import { useRealtimeBooking } from '../hooks/useRealtimeBooking';
import { useBroadcastStore, normalizeTenantId } from '../store/broadcastStore';
import BroadcastAlertBar from './BroadcastAlertBar';
import { useLocation, useNavigate } from 'react-router-dom';

export default function NotificationManager() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  // Attach SSE for real-time booking notifications & TTS broadcast
  useRealtimeBooking();

  // Smart Reminder Loop: Checks unacknowledged/unconfirmed bookings every 4 seconds
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      useBroadcastStore.getState().checkAndTriggerReminders();
    }, 4000);

    return () => clearInterval(interval);
  }, [token]);

  // Handle ?openBooking=<id> deep-link (e.g. opened from mobile Web Push tap)
  useEffect(() => {
    if (!token || !user || !location.pathname.startsWith('/admin')) return;
    const params = new URLSearchParams(location.search);
    const openBookingId = params.get('openBooking');
    if (!openBookingId) return;

    useBroadcastStore.getState().ensurePopupForAppointmentId(openBookingId, api);

    params.delete('openBooking');
    const cleanSearch = params.toString();
    navigate(`${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`, { replace: true });
  }, [token, user?.id, location.pathname, location.search, navigate]);

  // Listen for Service Worker Web Push messages when Admin app/PWA is open or tapped on mobile
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || !token || !user) return;
      const myTenantId = normalizeTenantId(useAuthStore.getState().user?.tenantId);

      if (msg.type === 'SW_PUSH_BOOKING' && msg.payload) {
        const payload = msg.payload;
        if (normalizeTenantId(payload.tenantId) !== myTenantId) return;
        if (payload.type === 'admin_booking' && payload.appointmentId) {
          useBroadcastStore.getState().handleIncomingBooking({
            id: payload.appointmentId,
            tenantId: payload.tenantId,
            patientName: payload.patientName,
            patientPhone: payload.patientPhone,
            serviceName: payload.serviceName,
            providerName: payload.providerName,
            startAt: payload.startAt,
            status: payload.status || 'REQUESTED',
          });
        }
      } else if (msg.type === 'OPEN_BOOKING_POPUP' && msg.appointmentId) {
        useBroadcastStore.getState().ensurePopupForAppointmentId(msg.appointmentId, api);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [token, user?.id, user?.tenantId]);

  // Upcoming appointment checks (15m reminder)
  useEffect(() => {
    const checkUpcomingAppointments = async () => {
      const now = new Date();
      // Skip notification check when user is on login page or unauthenticated
      if (token && !location.pathname.includes('/login')) {
        const currentUser = useAuthStore.getState().user;
        const myTenantId = normalizeTenantId(currentUser?.tenantId);
        // ADMIN MODE: Fetch today's appointments
        try {
          const res = await api.get('/appointments');
          if (res.data.success) {
            const appointments = res.data.data || [];
            appointments.forEach((apt: any) => {
              const aptTenantId = normalizeTenantId(apt?.tenantId);
              if (aptTenantId !== myTenantId) return;

              if ((apt.status === 'CONFIRMED' || apt.status === 'REQUESTED') && apt.startAt) {
                const diff = differenceInMinutes(parseISO(apt.startAt), now);
                if (diff > 0 && diff <= 15) {
                  const notifKey = `notif_admin_${myTenantId || 'root'}_${apt.id}`;
                  if (!sessionStorage.getItem(notifKey)) {
                    toast(`Sắp tới giờ hẹn: Khách ${apt.patientName} lúc ${formatTime(apt.startAt)}`, {
                      icon: '🔔',
                      duration: 8000,
                    });
                    sessionStorage.setItem(notifKey, 'true');
                  }
                }
              }
            });
          }
        } catch (error: any) {
          if (error.response?.status !== 401) {
            console.error('Failed to fetch admin notifications', error);
          }
        }
      } else {
        // PATIENT MODE: Check local storage
        const myApptsStr = localStorage.getItem('myAppointments');
        if (myApptsStr) {
          try {
            const myAppts = JSON.parse(myApptsStr);
            myAppts.forEach((apt: any) => {
              const diff = differenceInMinutes(parseISO(apt.startAt), now);
              if (diff > 0 && diff <= 60) {
                const notifKey = `notif_patient_${apt.id}_${diff <= 15 ? '15m' : '1h'}`;
                if (!sessionStorage.getItem(notifKey)) {
                  toast.success(`Bạn có lịch hẹn khám nha khoa sắp tới lúc ${formatTime(apt.startAt)}!`, {
                    icon: '🏥',
                    duration: 10000,
                    style: {
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                    },
                  });
                  sessionStorage.setItem(notifKey, 'true');
                }
              }
            });
          } catch {}
        }
      }
    };

    const formatTime = (isoString: string) => {
      if (!isoString) return '';
      try {
        const d = parseISO(isoString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    };

    // Check immediately, then every 1 minute
    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 60000);
    return () => clearInterval(interval);
  }, [token, user?.id, user?.tenantId, location.pathname]);

  return (
    <>
      <Toaster position="top-right" />
      {location.pathname.startsWith('/admin') && <BroadcastAlertBar />}
    </>
  );
}
