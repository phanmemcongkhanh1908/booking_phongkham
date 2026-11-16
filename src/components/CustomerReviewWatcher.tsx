import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { invalidateClinicCache } from '../services/clinicResolver';
import { useBookingStore } from '../store/booking';
import AppointmentReviewModal from './AppointmentReviewModal';
import {
  CUSTOMER_BOOKINGS_UPDATED_EVENT,
  getDeviceBookingMeta,
  getUnreviewedTrackedAppointmentIds,
  markDeviceBookingDismissed,
  markDeviceBookingReviewed,
  recordCustomerDeviceBooking,
  shouldAutoPromptReview,
} from '../utils/customerDeviceBookings';

function extractClinicSlugFromLocation(pathname: string, search: string): string {
  const pathMatch = pathname.match(/^\/(?:b|booking|s)\/([^/]+)/i);
  if (pathMatch?.[1]) {
    const seg = pathMatch[1].trim().toLowerCase();
    if (!['login', 'admin', 'dich-vu', 'chon-gio', 'thong-tin', 'xac-nhan', 'hoan-tat'].includes(seg)) {
      return seg;
    }
  }
  const params = new URLSearchParams(search);
  const qSlug = params.get('slug') || params.get('clinic') || params.get('s') || '';
  return qSlug.trim().toLowerCase();
}

export default function CustomerReviewWatcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeStoreAppointmentId = useBookingStore((s) => s.appointmentId);
  const activeStorePhone = useBookingStore((s) => s.patientPhone);
  const activeStoreName = useBookingStore((s) => s.patientName);
  const activeStoreSlug = useBookingStore((s) => s.clinicProfile?.slug);

  const isExcludedRoute =
    location.pathname.startsWith('/admin') ||
    /\/(login|admin)(\/|$)/i.test(location.pathname);

  const routeClinicSlug = extractClinicSlugFromLocation(location.pathname, location.search);

  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [activeReviewApt, setActiveReviewApt] = useState<any | null>(null);
  const modalOpenRef = useRef(false);

  useEffect(() => {
    modalOpenRef.current = Boolean(activeReviewApt);
  }, [activeReviewApt]);

  // Ensure in-memory active booking (e.g. step 5 /hoan-tat) is always mirrored to localStorage tracker
  useEffect(() => {
    if (isExcludedRoute || !activeStoreAppointmentId) return;
    recordCustomerDeviceBooking({
      id: activeStoreAppointmentId,
      clinicSlug: (activeStoreSlug || routeClinicSlug || null) as string | null,
      patientPhone: activeStorePhone || null,
      patientName: activeStoreName || null,
    });
  }, [isExcludedRoute, activeStoreAppointmentId, activeStorePhone, activeStoreName, activeStoreSlug, routeClinicSlug]);

  const refreshTrackedIds = useCallback(() => {
    if (isExcludedRoute) {
      setTrackedIds([]);
      return;
    }
    const ids = getUnreviewedTrackedAppointmentIds(routeClinicSlug || null);
    setTrackedIds(ids);
  }, [isExcludedRoute, routeClinicSlug]);

  useEffect(() => {
    refreshTrackedIds();
    const handleUpdate = () => refreshTrackedIds();
    window.addEventListener(CUSTOMER_BOOKINGS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(CUSTOMER_BOOKINGS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshTrackedIds]);

  const openPromptForAppointment = useCallback(
    (apt: any, forceImmediate = false) => {
      if (!apt?.id || isExcludedRoute) return;
      if (apt.reviewedAt || (typeof apt.rating === 'number' && apt.rating > 0)) {
        markDeviceBookingReviewed(apt.id);
        return;
      }
      if (!shouldAutoPromptReview(apt.id, forceImmediate)) return;
      if (modalOpenRef.current && activeReviewApt?.id === apt.id) return;

      // Prevent Clinic A completed appointment from popping up when customer is explicitly browsing Clinic B
      if (
        !forceImmediate &&
        routeClinicSlug &&
        apt.clinicSlug &&
        String(apt.clinicSlug).trim().toLowerCase() !== routeClinicSlug
      ) {
        return;
      }

      setActiveReviewApt(apt);
    },
    [isExcludedRoute, routeClinicSlug, activeReviewApt?.id]
  );

  const checkPendingReviews = useCallback(async () => {
    if (isExcludedRoute || modalOpenRef.current) return;
    const ids = getUnreviewedTrackedAppointmentIds(routeClinicSlug || null);
    if (ids.length === 0) return;

    try {
      const res = await api.post('/public/appointments/pending-reviews', {
        appointmentIds: ids,
        clinicSlug: routeClinicSlug || undefined,
      });
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const candidate = res.data.data.find((apt: any) => shouldAutoPromptReview(apt.id, false));
        if (candidate) {
          openPromptForAppointment(candidate, false);
        }
      }
    } catch {
      // Silent background check failure
    }
  }, [isExcludedRoute, routeClinicSlug, openPromptForAppointment]);

  // 1. Handle ?reviewAppointmentId=<id> deep-link (e.g. from Web Push tap or reminder link)
  useEffect(() => {
    if (isExcludedRoute) return;
    const params = new URLSearchParams(location.search);
    const targetReviewId = params.get('reviewAppointmentId');
    if (!targetReviewId) return;

    let cancelled = false;
    api
      .get(`/public/appointments/${encodeURIComponent(targetReviewId)}`)
      .then((res) => {
        if (cancelled) return;
        const apt = res.data?.data;
        if (apt && String(apt.status || '').toUpperCase() === 'COMPLETED' && !apt.rating && !apt.reviewedAt) {
          openPromptForAppointment(apt, true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        params.delete('reviewAppointmentId');
        const cleanSearch = params.toString();
        navigate(`${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [isExcludedRoute, location.pathname, location.search, navigate, openPromptForAppointment]);

  // 2. Real-time SSE connection for immediate popup on the customer booking device
  useEffect(() => {
    if (isExcludedRoute || trackedIds.length === 0) return;

    let es: EventSource | null = null;
    let reconnectTimer: any = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        const query = encodeURIComponent(trackedIds.join(','));
        es = new EventSource(`/api/public/appointments/stream?ids=${query}`);

        es.addEventListener('APPOINTMENT_COMPLETED', (event: any) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload?.id) return;
            openPromptForAppointment(payload, true);
          } catch {}
        });

        es.onerror = () => {
          es?.close();
          es = null;
          if (!closed && document.visibilityState !== 'hidden') {
            reconnectTimer = setTimeout(connect, 15000);
          }
        };
      } catch {
        reconnectTimer = setTimeout(connect, 20000);
      }
    };

    connect();

    return () => {
      closed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [isExcludedRoute, trackedIds.join(','), openPromptForAppointment]);

  // 3. Service Worker push message bridge (when Web Push fires while tab is open or clicked)
  useEffect(() => {
    if (isExcludedRoute || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'SW_PATIENT_REVIEW_REQUEST' && msg.payload?.appointmentId) {
        api
          .get(`/public/appointments/${encodeURIComponent(msg.payload.appointmentId)}`)
          .then((res) => {
            if (res.data?.data) {
              openPromptForAppointment(res.data.data, true);
            }
          })
          .catch(() => {});
      } else if (msg.type === 'OPEN_CUSTOMER_REVIEW_POPUP' && msg.appointmentId) {
        api
          .get(`/public/appointments/${encodeURIComponent(msg.appointmentId)}`)
          .then((res) => {
            if (res.data?.data) {
              openPromptForAppointment(res.data.data, true);
            }
          })
          .catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [isExcludedRoute, openPromptForAppointment]);

  // 4. Mount / Focus / Resume / Periodic check so reopening browser or waking phone catches completed visits
  useEffect(() => {
    if (isExcludedRoute || trackedIds.length === 0) return;

    checkPendingReviews();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPendingReviews();
      }
    };
    const onFocus = () => {
      checkPendingReviews();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(checkPendingReviews, 20000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [isExcludedRoute, trackedIds.join(','), checkPendingReviews]);

  if (isExcludedRoute || !activeReviewApt) return null;

  const deviceMeta = getDeviceBookingMeta(activeReviewApt.id);
  const storedPhone = deviceMeta?.patientPhone || activeStorePhone || undefined;

  return (
    <AppointmentReviewModal
      isOpen={Boolean(activeReviewApt)}
      onClose={() => setActiveReviewApt(null)}
      onDismiss={() => {
        if (activeReviewApt?.id) {
          markDeviceBookingDismissed(activeReviewApt.id);
        }
      }}
      appointment={activeReviewApt}
      isStaffMode={false}
      phone={storedPhone}
      bookingCode={activeReviewApt.id}
      onSuccess={() => {
        if (activeReviewApt?.id) {
          markDeviceBookingReviewed(activeReviewApt.id);
        }
        invalidateClinicCache();
        refreshTrackedIds();
      }}
    />
  );
}
