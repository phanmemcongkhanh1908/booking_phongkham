import React, { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { differenceInMinutes, parseISO } from 'date-fns';
import api from '../services/api';

export default function NotificationManager() {
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    const checkUpcomingAppointments = async () => {
      const now = new Date();

      if (token) {
        // ADMIN MODE: Fetch today's appointments
        try {
          const res = await api.get('/appointments');
          if (res.data.success) {
            const appointments = res.data.data;
            appointments.forEach((apt: any) => {
              if ((apt.status === 'CONFIRMED' || apt.status === 'REQUESTED') && apt.startAt) {
                const diff = differenceInMinutes(parseISO(apt.startAt), now);
                if (diff > 0 && diff <= 15) {
                  // Only toast if not already toasted for this specific time recently
                  // In a real app we'd track shown notifications, here we use a simple sessionStorage flag
                  const notifKey = `notif_admin_${apt.id}`;
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
        } catch (error) {
          if (error.response?.status !== 401) { console.error("Failed to fetch admin notifications", error); }
        }
      } else {
        // PATIENT MODE: Check local storage
        const myApptsStr = localStorage.getItem('myAppointments');
        if (myApptsStr) {
          const myAppts = JSON.parse(myApptsStr);
          myAppts.forEach((apt: any) => {
            const diff = differenceInMinutes(parseISO(apt.startAt), now);
            if (diff > 0 && diff <= 60) { // Notify patient 1 hour and 15 mins before
              const notifKey = `notif_patient_${apt.id}_${diff <= 15 ? '15m' : '1h'}`;
              if (!sessionStorage.getItem(notifKey)) {
                toast.success(`Bạn có lịch hẹn khám nha khoa sắp tới lúc ${formatTime(apt.startAt)}!`, {
                  icon: '🏥',
                  duration: 10000,
                  style: {
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0'
                  },
                });
                sessionStorage.setItem(notifKey, 'true');
              }
            }
          });
        }
      }
    };

    const formatTime = (isoString: string) => {
      if (!isoString) return '';
      try {
        const d = parseISO(isoString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return '';
      }
    };

    // Check immediately, then every 1 minute
    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 60000);

    return () => clearInterval(interval);
  }, [token]);

  return <Toaster position="top-right" />;
}
