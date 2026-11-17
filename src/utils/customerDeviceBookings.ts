export interface DeviceBookedAppointment {
  id: string;
  tenantId?: string | null;
  clinicSlug?: string | null;
  clinicName?: string | null;
  patientPhone?: string | null;
  patientName?: string | null;
  serviceId?: string | null;
  serviceIds?: string[] | null;
  serviceName?: string | null;
  providerName?: string | null;
  startAt?: string | null;
  lastKnownStatus?: string | null;
  lastKnownStartAt?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  dismissedAt?: string | null;
}

const STORAGE_KEY = 'dental_device_booked_appointments';
const SEEN_STATUS_KEY = 'dental_customer_seen_status_events';
const MAX_STORED = 50;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const DISMISS_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export const CUSTOMER_BOOKINGS_UPDATED_EVENT = 'customer-device-bookings-updated';
export const CUSTOMER_REVIEW_SUBMITTED_EVENT = 'customer-review-submitted';
export const CUSTOMER_STATUS_UPDATED_EVENT = 'customer-appointment-status-updated';

function safeReadList(): DeviceBookedAppointment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETENTION_MS;
    return parsed.filter(
      (item: any) =>
        item &&
        typeof item.id === 'string' &&
        item.id.length >= 8 &&
        (!item.createdAt || new Date(item.createdAt).getTime() >= cutoff)
    );
  } catch {
    return [];
  }
}

function safeWriteList(list: DeviceBookedAppointment[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORED)));
    window.dispatchEvent(new CustomEvent(CUSTOMER_BOOKINGS_UPDATED_EVENT));
  } catch {}
}

function safeReadSeenMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SEEN_STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function safeWriteSeenMap(map: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 120 entries max
    const entries = Object.entries(map)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 120);
    localStorage.setItem(SEEN_STATUS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function buildStatusNotificationKey(appointmentId: string, status: string, startAt?: string | null): string {
  const normStatus = String(status || '').trim().toUpperCase();
  const timePart = startAt ? String(new Date(startAt).getTime() || startAt) : 'no-time';
  return `${appointmentId}:${normStatus}:${timePart}`;
}

export function hasSeenStatusNotification(appointmentId: string, status: string, startAt?: string | null): boolean {
  const map = safeReadSeenMap();
  const key = buildStatusNotificationKey(appointmentId, status, startAt);
  return Boolean(map[key]);
}

export function markStatusNotificationSeen(appointmentId: string, status: string, startAt?: string | null) {
  if (!appointmentId || !status) return;
  const map = safeReadSeenMap();
  const key = buildStatusNotificationKey(appointmentId, status, startAt);
  map[key] = Date.now();
  safeWriteSeenMap(map);
}

export function getDeviceBookedAppointments(): DeviceBookedAppointment[] {
  return safeReadList();
}

export function recordCustomerDeviceBooking(
  entry: Omit<DeviceBookedAppointment, 'createdAt'> & { createdAt?: string }
) {
  if (!entry?.id) return;
  const list = safeReadList();
  const existingIdx = list.findIndex((item) => item.id === entry.id);
  const initialStatus = entry.lastKnownStatus || (existingIdx >= 0 ? list[existingIdx].lastKnownStatus : 'REQUESTED') || 'REQUESTED';
  const nextItem: DeviceBookedAppointment = {
    ...(existingIdx >= 0 ? list[existingIdx] : {}),
    ...entry,
    id: String(entry.id).trim(),
    clinicSlug: entry.clinicSlug ? String(entry.clinicSlug).trim().toLowerCase() : existingIdx >= 0 ? list[existingIdx].clinicSlug : null,
    lastKnownStatus: initialStatus,
    lastKnownStartAt: entry.lastKnownStartAt || entry.startAt || (existingIdx >= 0 ? list[existingIdx].lastKnownStartAt : null) || null,
    createdAt: (existingIdx >= 0 ? list[existingIdx].createdAt : undefined) || entry.createdAt || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    list[existingIdx] = nextItem;
  } else {
    list.unshift(nextItem);
  }
  safeWriteList(list);
}

export function updateDeviceBookingSnapshot(
  appointmentId: string,
  patch: Partial<Pick<DeviceBookedAppointment, 'lastKnownStatus' | 'lastKnownStartAt' | 'startAt' | 'providerName' | 'serviceName' | 'clinicSlug' | 'clinicName'>>
) {
  if (!appointmentId) return;
  const list = safeReadList();
  const idx = list.findIndex((i) => i.id === appointmentId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    safeWriteList(list);
  }
}

export function syncCustomerLookupBookings(
  appointments: Array<{
    id: string;
    status?: string;
    serviceId?: string | null;
    serviceIds?: string[] | null;
    serviceName?: string | null;
    providerName?: string | null;
    patientName?: string | null;
    startAt?: string | null;
    rating?: number | null;
    reviewedAt?: string | null;
  }>,
  patientPhone?: string | null,
  clinicSlug?: string | null
) {
  if (!Array.isArray(appointments) || appointments.length === 0) return;
  const list = safeReadList();
  let changed = false;

  for (const apt of appointments) {
    if (!apt?.id) continue;
    const statusUpper = String(apt.status || '').toUpperCase();
    // Skip cancelled appointments from active review tracking
    if (['CANCEL_PATIENT', 'CANCEL_CLINIC', 'CANCELLED', 'NO_SHOW'].includes(statusUpper)) {
      const idx = list.findIndex((i) => i.id === apt.id);
      if (idx >= 0) {
        list.splice(idx, 1);
        changed = true;
      }
      continue;
    }

    const isReviewed = Boolean(apt.reviewedAt) || (typeof apt.rating === 'number' && apt.rating > 0);
    const idx = list.findIndex((i) => i.id === apt.id);
    if (idx >= 0) {
      const prev = list[idx];
      const nextPatch: Partial<DeviceBookedAppointment> = {};
      if (isReviewed && !prev.reviewedAt) {
        nextPatch.reviewedAt = apt.reviewedAt || new Date().toISOString();
      }
      if (patientPhone && !prev.patientPhone) {
        nextPatch.patientPhone = patientPhone;
      }
      if (statusUpper && prev.lastKnownStatus !== statusUpper) {
        nextPatch.lastKnownStatus = statusUpper;
      }
      if (apt.startAt && prev.lastKnownStartAt !== apt.startAt) {
        nextPatch.lastKnownStartAt = apt.startAt;
        nextPatch.startAt = apt.startAt;
      }
      if (Object.keys(nextPatch).length > 0) {
        list[idx] = { ...prev, ...nextPatch };
        changed = true;
      }
    } else {
      list.unshift({
        id: apt.id,
        clinicSlug: clinicSlug ? clinicSlug.trim().toLowerCase() : null,
        patientPhone: patientPhone || null,
        patientName: apt.patientName || null,
        serviceId: apt.serviceId || null,
        serviceIds: apt.serviceIds || null,
        serviceName: apt.serviceName || null,
        providerName: apt.providerName || null,
        startAt: apt.startAt || null,
        lastKnownStatus: statusUpper || null,
        lastKnownStartAt: apt.startAt || null,
        createdAt: new Date().toISOString(),
        reviewedAt: isReviewed ? apt.reviewedAt || new Date().toISOString() : null,
      });
      changed = true;
    }
  }

  if (changed) {
    safeWriteList(list);
  }
}

export function getAllTrackedAppointmentIds(filterClinicSlug?: string | null): string[] {
  const list = safeReadList();
  const cleanFilter = filterClinicSlug ? filterClinicSlug.trim().toLowerCase() : '';
  return list
    .filter((item) => {
      if (cleanFilter && item.clinicSlug && item.clinicSlug !== cleanFilter) return false;
      return true;
    })
    .map((item) => item.id);
}

export function getUnreviewedTrackedAppointmentIds(filterClinicSlug?: string | null): string[] {
  const list = safeReadList();
  const cleanFilter = filterClinicSlug ? filterClinicSlug.trim().toLowerCase() : '';
  return list
    .filter((item) => {
      if (item.reviewedAt) return false;
      if (cleanFilter && item.clinicSlug && item.clinicSlug !== cleanFilter) return false;
      return true;
    })
    .map((item) => item.id);
}

export function getDeviceBookingMeta(appointmentId: string): DeviceBookedAppointment | undefined {
  return safeReadList().find((i) => i.id === appointmentId);
}

export function shouldAutoPromptReview(appointmentId: string, forceImmediate = false): boolean {
  const meta = getDeviceBookingMeta(appointmentId);
  if (meta?.reviewedAt) return false;
  if (forceImmediate) return true;
  if (meta?.dismissedAt) {
    const elapsed = Date.now() - new Date(meta.dismissedAt).getTime();
    if (Number.isFinite(elapsed) && elapsed < DISMISS_COOLDOWN_MS) {
      return false;
    }
  }
  return true;
}

export function markDeviceBookingReviewed(appointmentId: string) {
  if (!appointmentId) return;
  const list = safeReadList();
  const idx = list.findIndex((i) => i.id === appointmentId);
  const nowIso = new Date().toISOString();
  if (idx >= 0) {
    list[idx] = { ...list[idx], reviewedAt: nowIso, lastKnownStatus: 'COMPLETED' };
  } else {
    list.unshift({
      id: appointmentId,
      createdAt: nowIso,
      reviewedAt: nowIso,
      lastKnownStatus: 'COMPLETED',
    });
  }
  safeWriteList(list);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOMER_REVIEW_SUBMITTED_EVENT, { detail: { appointmentId } }));
  }
}

export function markDeviceBookingDismissed(appointmentId: string) {
  if (!appointmentId) return;
  const list = safeReadList();
  const idx = list.findIndex((i) => i.id === appointmentId);
  const nowIso = new Date().toISOString();
  if (idx >= 0) {
    list[idx] = { ...list[idx], dismissedAt: nowIso };
    safeWriteList(list);
  }
}
