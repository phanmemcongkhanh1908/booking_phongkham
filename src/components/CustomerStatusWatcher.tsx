import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { differenceInMinutes, parseISO } from 'date-fns';
import api from '../services/api';
import { useBookingStore } from '../store/booking';
import CustomerAppointmentStatusPopup, {
  CustomerStatusAlertData,
} from './CustomerAppointmentStatusPopup';
import { customerRealtimeStream } from '../utils/customerRealtimeStream';
import {
  CUSTOMER_BOOKINGS_UPDATED_EVENT,
  CUSTOMER_STATUS_UPDATED_EVENT,
  getAllTrackedAppointmentIds,
  getDeviceBookingMeta,
  hasSeenStatusNotification,
  markStatusNotificationSeen,
  updateDeviceBookingSnapshot,
} from '../utils/customerDeviceBookings';
import { patchOfflineAppointment } from '../utils/offlineBookingDb';

function extractClinicSlugFromLocation(pathname: string, search: string): string {
  const pathMatch = pathname.match(/^\/(?:b|booking|s)\/([^/]+)/i);
  if (pathMatch?.[1]) {
    const seg = pathMatch[1].trim().toLowerCase();
    if (!['login', 'admin', 'dich-vu', 'chon-gio', 'thong-tin', 'xac-nhan', 'hoan-tat', 'lich-hen'].includes(seg)) {
      return seg;
    }
  }
  const params = new URLSearchParams(search);
  const qSlug = params.get('slug') || params.get('clinic') || params.get('s') || '';
  return qSlug.trim().toLowerCase();
}

function playGentleCustomerChime() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playNote(587.33, 0, 0.22); // D5
    playNote(880.0, 0.14, 0.35); // A5
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 900);
  } catch {}
}

function vibrateCustomerDevice() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([150, 80, 150]);
    }
  } catch {}
}

export default function CustomerStatusWatcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeStorePhone = useBookingStore((s) => s.patientPhone);

  const isExcludedRoute =
    location.pathname.startsWith('/admin') ||
    /\/(login|admin)(\/|$)/i.test(location.pathname);

  const routeClinicSlug = extractClinicSlugFromLocation(location.pathname, location.search);

  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [activeAlert, setActiveAlert] = useState<CustomerStatusAlertData | null>(null);
  const alertOpenRef = useRef(false);

  useEffect(() => {
    alertOpenRef.current = Boolean(activeAlert);
  }, [activeAlert]);

  const refreshTrackedIds = useCallback(() => {
    if (isExcludedRoute) {
      setTrackedIds([]);
      return;
    }
    setTrackedIds(getAllTrackedAppointmentIds(routeClinicSlug || null));
  }, [isExcludedRoute, routeClinicSlug]);

  useEffect(() => {
    refreshTrackedIds();
    const onUpdate = () => refreshTrackedIds();
    window.addEventListener(CUSTOMER_BOOKINGS_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(CUSTOMER_BOOKINGS_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [refreshTrackedIds]);

  const triggerStatusPopup = useCallback(
    (payload: CustomerStatusAlertData, options?: { force?: boolean; skipSound?: boolean }) => {
      if (!payload?.id || isExcludedRoute) return;
      const effectiveStatus = String(payload.eventStatus || payload.status || '').toUpperCase();
      if (!effectiveStatus) return;

      const dedupeKeyStatus = payload.isOneHourReminder ? 'REMINDER_1H' : effectiveStatus;
      if (!options?.force && hasSeenStatusNotification(payload.id, dedupeKeyStatus, payload.startAt)) {
        return;
      }

      if (
        !options?.force &&
        routeClinicSlug &&
        payload.clinicSlug &&
        String(payload.clinicSlug).trim().toLowerCase() !== routeClinicSlug
      ) {
        return;
      }

      markStatusNotificationSeen(payload.id, dedupeKeyStatus, payload.startAt);
      updateDeviceBookingSnapshot(payload.id, {
        lastKnownStatus: effectiveStatus === 'RESCHEDULED' ? payload.status || 'CONFIRMED' : effectiveStatus,
        ...(payload.startAt ? { lastKnownStartAt: payload.startAt, startAt: payload.startAt } : {}),
        ...(payload.providerName ? { providerName: payload.providerName } : {}),
      });
      void patchOfflineAppointment(payload.id, {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.startAt ? { startAt: payload.startAt } : {}),
        ...(payload.endAt ? { endAt: payload.endAt } : {}),
        ...(payload.cancelReason ? { cancelReason: payload.cancelReason } : {}),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CUSTOMER_STATUS_UPDATED_EVENT, { detail: payload }));
      }

      if (!options?.skipSound) {
        playGentleCustomerChime();
        vibrateCustomerDevice();
      }
      setActiveAlert(payload);
    },
    [isExcludedRoute, routeClinicSlug]
  );

  // Check server for any status updates that happened while the customer had browser closed
  const syncDeviceStatuses = useCallback(async () => {
    if (isExcludedRoute || typeof navigator !== 'undefined' && !navigator.onLine) return;
    const ids = getAllTrackedAppointmentIds(routeClinicSlug || null);
    if (ids.length === 0) return;

    try {
      const res = await api.post('/public/appointments/device-statuses', {
        appointmentIds: ids,
        clinicSlug: routeClinicSlug || undefined,
      });

      if (!res.data?.success || !Array.isArray(res.data.data)) return;

      const now = new Date();
      for (const apt of res.data.data) {
        if (!apt?.id) continue;
        const meta = getDeviceBookingMeta(apt.id);
        const serverStatus = String(apt.status || '').toUpperCase();
        const prevStatus = String(meta?.lastKnownStatus || '').toUpperCase();
        const timeChanged =
          Boolean(apt.startAt && meta?.lastKnownStartAt) &&
          Math.abs(new Date(apt.startAt).getTime() - new Date(meta!.lastKnownStartAt!).getTime()) > 60000;

        // Sync offline cache & local snapshot quietly
        updateDeviceBookingSnapshot(apt.id, {
          lastKnownStatus: serverStatus,
          lastKnownStartAt: apt.startAt || meta?.lastKnownStartAt || null,
          startAt: apt.startAt || meta?.startAt || null,
          providerName: apt.providerName || meta?.providerName || null,
        });
        void patchOfflineAppointment(apt.id, {
          status: apt.status,
          startAt: apt.startAt,
          endAt: apt.endAt,
          cancelReason: apt.cancelReason,
        });

        if (prevStatus !== serverStatus) {
          window.dispatchEvent(new CustomEvent(CUSTOMER_STATUS_UPDATED_EVENT, { detail: apt }));
        }

        // Pop up on screen for meaningful clinic actions: CONFIRMED, RESCHEDULED (timeChanged), CANCEL_CLINIC
        const shouldAlertConfirmed =
          serverStatus === 'CONFIRMED' &&
          (!prevStatus || prevStatus === 'REQUESTED' || prevStatus === 'PENDING') &&
          !hasSeenStatusNotification(apt.id, 'CONFIRMED', apt.startAt);

        const shouldAlertCancel =
          serverStatus === 'CANCEL_CLINIC' &&
          !hasSeenStatusNotification(apt.id, 'CANCEL_CLINIC', apt.startAt);

        const shouldAlertRescheduled =
          timeChanged &&
          ['CONFIRMED', 'REQUESTED', 'PENDING'].includes(serverStatus) &&
          !hasSeenStatusNotification(apt.id, 'RESCHEDULED', apt.startAt);

        let shouldAlert1hReminder = false;
        if (serverStatus === 'CONFIRMED' && apt.startAt) {
          try {
            const diffMins = differenceInMinutes(parseISO(String(apt.startAt)), now);
            if (diffMins > 0 && diffMins <= 65 && !hasSeenStatusNotification(apt.id, 'REMINDER_1H', apt.startAt)) {
              shouldAlert1hReminder = true;
            }
          } catch {}
        }

        if (!alertOpenRef.current) {
          if (shouldAlertCancel) {
            triggerStatusPopup({ ...apt, eventStatus: 'CANCEL_CLINIC' });
            break;
          } else if (shouldAlertRescheduled) {
            triggerStatusPopup({ ...apt, eventStatus: 'RESCHEDULED' });
            break;
          } else if (shouldAlertConfirmed) {
            triggerStatusPopup({ ...apt, eventStatus: 'CONFIRMED' });
            break;
          } else if (shouldAlert1hReminder) {
            triggerStatusPopup({ ...apt, eventStatus: 'CONFIRMED', isOneHourReminder: true });
            break;
          }
        }
      }
    } catch {
      // Silent background sync error
    }
  }, [isExcludedRoute, routeClinicSlug, triggerStatusPopup]);

  // 1. Handle ?highlightAppointmentId=<id> deep-link (when user clicks OS Notification Bar)
  useEffect(() => {
    if (isExcludedRoute) return;
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlightAppointmentId');
    if (!highlightId) return;

    let cancelled = false;
    api
      .get(`/public/appointments/${encodeURIComponent(highlightId)}`)
      .then((res) => {
        if (cancelled) return;
        const apt = res.data?.data;
        if (apt?.id) {
          const statusParam = params.get('status');
          triggerStatusPopup(
            {
              id: apt.id,
              status: apt.status,
              eventStatus: statusParam || apt.status,
              clinicName: apt.clinicName,
              clinicSlug: apt.clinicSlug,
              clinicAddress: apt.clinicAddress,
              clinicPhone: apt.clinicPhone,
              serviceName: apt.serviceName,
              providerName: apt.providerName,
              patientName: apt.patientName,
              startAt: apt.startAt,
              endAt: apt.endAt,
              cancelReason: apt.cancelReason,
            },
            { force: true, skipSound: true }
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        params.delete('highlightAppointmentId');
        params.delete('status');
        const cleanSearch = params.toString();
        navigate(`${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [isExcludedRoute, location.pathname, location.search, navigate, triggerStatusPopup]);

  // 2. Shared real-time SSE listener for instant confirmation popup while page is open
  useEffect(() => {
    if (isExcludedRoute || trackedIds.length === 0) return;

    const unsubscribe = customerRealtimeStream.subscribe(trackedIds, (eventType, payload) => {
      if (eventType === 'APPOINTMENT_STATUS_UPDATED' && payload?.id) {
        const effStatus = String(payload.eventStatus || payload.status || '').toUpperCase();
        if (['CONFIRMED', 'RESCHEDULED', 'TIME_CHANGED', 'CANCEL_CLINIC'].includes(effStatus)) {
          triggerStatusPopup(payload, { force: true });
        } else {
          window.dispatchEvent(new CustomEvent(CUSTOMER_STATUS_UPDATED_EVENT, { detail: payload }));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isExcludedRoute, trackedIds.join(','), triggerStatusPopup]);

  // 3. Service Worker postMessage bridge (live push arrival OR notification click while tab is open)
  useEffect(() => {
    if (isExcludedRoute || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'SW_PATIENT_STATUS_UPDATE' && msg.payload?.appointmentId) {
        const p = msg.payload;
        triggerStatusPopup({
          id: p.appointmentId,
          status: p.status || 'CONFIRMED',
          eventStatus: p.type === 'patient_rescheduled' ? 'RESCHEDULED' : p.status || 'CONFIRMED',
          isOneHourReminder: p.type === 'appointment_1h_reminder',
          clinicName: p.clinicName,
          clinicSlug: p.clinicSlug,
          clinicAddress: p.clinicAddress,
          clinicPhone: p.clinicPhone,
          latitude: p.latitude,
          longitude: p.longitude,
          serviceName: p.serviceName,
          providerName: p.providerName,
          patientName: p.patientName,
          startAt: p.startAt,
          endAt: p.endAt,
          cancelReason: p.cancelReason,
        });
      } else if (msg.type === 'OPEN_CUSTOMER_STATUS_POPUP' && (msg.appointmentId || msg.payload?.appointmentId)) {
        const targetId = msg.appointmentId || msg.payload?.appointmentId;
        const p = msg.payload;
        if (p && p.clinicName && p.startAt) {
          triggerStatusPopup(
            {
              id: targetId,
              status: p.status || 'CONFIRMED',
              eventStatus: p.type === 'patient_rescheduled' ? 'RESCHEDULED' : p.status || 'CONFIRMED',
              isOneHourReminder: p.type === 'appointment_1h_reminder',
              clinicName: p.clinicName,
              clinicSlug: p.clinicSlug,
              clinicAddress: p.clinicAddress,
              clinicPhone: p.clinicPhone,
              latitude: p.latitude,
              longitude: p.longitude,
              serviceName: p.serviceName,
              providerName: p.providerName,
              patientName: p.patientName,
              startAt: p.startAt,
              endAt: p.endAt,
              cancelReason: p.cancelReason,
            },
            { force: true, skipSound: true }
          );
        } else if (targetId) {
          api
            .get(`/public/appointments/${encodeURIComponent(targetId)}`)
            .then((res) => {
              if (res.data?.data) {
                triggerStatusPopup(res.data.data, { force: true, skipSound: true });
              }
            })
            .catch(() => {});
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [isExcludedRoute, triggerStatusPopup]);

  // 4. Mount / Visibility / Focus / Polling reconciliation
  useEffect(() => {
    if (isExcludedRoute || trackedIds.length === 0) return;

    syncDeviceStatuses();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncDeviceStatuses();
      }
    };
    const onFocus = () => {
      syncDeviceStatuses();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(syncDeviceStatuses, 20000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [isExcludedRoute, trackedIds.join(','), syncDeviceStatuses]);

  const handleOpenLookup = (alert: CustomerStatusAlertData) => {
    const meta = getDeviceBookingMeta(alert.id);
    const phoneToSave = meta?.patientPhone || activeStorePhone || '';
    const nameToSave = meta?.patientName || alert.patientName || '';
    if (phoneToSave && nameToSave) {
      try {
        localStorage.setItem(
          'verifiedPatient',
          JSON.stringify({ phone: phoneToSave, fullName: nameToSave })
        );
      } catch {}
    }

    const effectiveSlug = (
      alert.clinicSlug ||
      routeClinicSlug ||
      meta?.clinicSlug ||
      localStorage.getItem('last_clinic_slug') ||
      ''
    )
      .trim()
      .toLowerCase();

    const lookupPath = effectiveSlug ? `/b/${effectiveSlug}/lich-hen` : '/lich-hen-cua-toi';
    setActiveAlert(null);
    navigate(lookupPath, {
      state: {
        slug: effectiveSlug || undefined,
        clinicName: alert.clinicName || meta?.clinicName || undefined,
        phone: phoneToSave || undefined,
        fullName: nameToSave || undefined,
      },
    });
  };

  if (isExcludedRoute || !activeAlert) return null;

  return (
    <CustomerAppointmentStatusPopup
      alert={activeAlert}
      onClose={() => setActiveAlert(null)}
      onOpenLookup={handleOpenLookup}
    />
  );
}
