export interface OfflineAppointmentRecord {
  id: string;
  bookingCode?: string;
  startAt: string;
  endAt: string;
  status: string;
  serviceId?: string;
  serviceIds?: string[] | null;
  serviceItems?: Array<{ id: string; name: string }> | null;
  serviceRatings?: Record<string, number> | null;
  serviceName: string;
  providerName: string | null;
  patientName: string;
  bookedForName?: string | null;
  bookingFor?: 'self' | 'relative' | string | null;
  isProxyBooking?: boolean | null;
  notes?: string | null;
  cancelReason?: string | null;
  rating?: number | null;
  reviewComment?: string | null;
  reviewTags?: string[] | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
  clinicSlug?: string | null;
  clinicName?: string | null;
  patientPhone?: string;
  cachedAt: string;
}

export interface PendingOfflineBooking {
  id: string;
  status: 'pending' | 'syncing' | 'conflict' | 'failed';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string | null;
  tenantId?: string | null;
  clinicSlug?: string | null;
  clinicName?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  serviceId?: string | null;
  serviceIds?: string[];
  serviceName: string;
  customServiceName?: string;
  startAt: string;
  endAt: string;
  sessionToken?: string | null;
  fullName: string;
  phone: string;
  email?: string;
  telegramId?: string;
  notes?: string;
  bookingFor?: 'self' | 'relative' | string;
  isNewProfile?: boolean;
}

export const OFFLINE_QUEUE_UPDATED_EVENT = 'dental-offline-queue-updated';

const DB_NAME = 'dental_smart_offline_v1';
const DB_VERSION = 2;
const STORE_NAME = 'appointments';
const PENDING_STORE_NAME = 'pending_bookings';

function dispatchOfflineQueueUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
  }
}

export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('patientPhone', 'patientPhone', { unique: false });
        store.createIndex('clinicSlug', 'clinicSlug', { unique: false });
        store.createIndex('startAt', 'startAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE_NAME)) {
        const pendingStore = db.createObjectStore(PENDING_STORE_NAME, { keyPath: 'id' });
        pendingStore.createIndex('status', 'status', { unique: false });
        pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
        pendingStore.createIndex('phone', 'phone', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function normalizeRecord(
  item: any,
  extra?: { phone?: string; clinicSlug?: string | null; clinicName?: string | null; fullName?: string }
): OfflineAppointmentRecord | null {
  const rawId = item?.id ?? item?.appointmentId;
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') return null;
  const idStr = String(rawId).trim();

  const rawPhone = extra?.phone || item?.patientPhone || item?.patient?.phone || '';
  const patientPhone = normalizePhoneDigits(rawPhone);
  const patientName = extra?.fullName || item?.patientName || item?.patient?.fullName || '';

  return {
    id: idStr,
    bookingCode: String(item?.bookingCode || `#${idStr.slice(-6)}`),
    startAt: String(item?.startAt || new Date().toISOString()),
    endAt: String(item?.endAt || item?.startAt || new Date().toISOString()),
    status: String(item?.status || 'REQUESTED'),
    serviceId: item?.serviceId ? String(item.serviceId) : (item?.service?.id ? String(item.service.id) : ''),
    serviceIds: Array.isArray(item?.serviceIds) ? item.serviceIds.map(String) : null,
    serviceItems: Array.isArray(item?.serviceItems) ? item.serviceItems : null,
    serviceRatings: item?.serviceRatings ?? null,
    serviceName: String(item?.serviceName || item?.service?.name || 'Dịch vụ nha khoa'),
    providerName: item?.providerName ?? item?.provider?.name ?? null,
    patientName,
    bookedForName: item?.bookedForName ?? null,
    bookingFor: item?.bookingFor ?? null,
    isProxyBooking: typeof item?.isProxyBooking === 'boolean' ? item.isProxyBooking : null,
    notes: item?.notes ?? null,
    cancelReason: item?.cancelReason ?? null,
    rating: typeof item?.rating === 'number' ? item.rating : null,
    reviewComment: item?.reviewComment ?? null,
    reviewTags: Array.isArray(item?.reviewTags) ? item.reviewTags : null,
    reviewedAt: item?.reviewedAt ?? null,
    createdAt: item?.createdAt ?? null,
    clinicSlug: extra?.clinicSlug ?? item?.clinicSlug ?? null,
    clinicName: extra?.clinicName ?? item?.clinicName ?? null,
    patientPhone,
    cachedAt: new Date().toISOString(),
  };
}

export async function saveOfflineAppointments(
  appointments: any[],
  extra?: { phone?: string; clinicSlug?: string | null; clinicName?: string | null; fullName?: string }
): Promise<void> {
  if (!isIndexedDbSupported() || !Array.isArray(appointments) || appointments.length === 0) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const raw of appointments) {
        const normalized = normalizeRecord(raw, extra);
        if (normalized) {
          store.put(normalized);
        }
      }

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[OfflineBookingDB] saveOfflineAppointments error:', err);
  }
}

export async function saveSingleOfflineAppointment(
  appointment: any,
  extra?: { phone?: string; clinicSlug?: string | null; clinicName?: string | null; fullName?: string }
): Promise<void> {
  if (!appointment) return;
  await saveOfflineAppointments([appointment], extra);
}

export async function patchOfflineAppointment(
  id: string | number,
  patch: Partial<OfflineAppointmentRecord>
): Promise<void> {
  const idStr = String(id ?? '').trim();
  if (!isIndexedDbSupported() || !idStr) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(idStr);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            ...patch,
            cachedAt: new Date().toISOString(),
          });
        }
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[OfflineBookingDB] patchOfflineAppointment error:', err);
  }
}

export async function getOfflineAppointments(filter?: {
  phone?: string | null;
  clinicSlug?: string | null;
}): Promise<OfflineAppointmentRecord[]> {
  if (!isIndexedDbSupported()) return [];

  try {
    const db = await openOfflineDb();
    const normalizedPhone = normalizePhoneDigits(filter?.phone);
    const targetSlug = (filter?.clinicSlug || '').trim().toLowerCase();

    return await new Promise<OfflineAppointmentRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        db.close();
        let results: OfflineAppointmentRecord[] = Array.isArray(req.result) ? req.result : [];

        if (normalizedPhone) {
          results = results.filter(
            (r) => normalizePhoneDigits(r.patientPhone) === normalizedPhone
          );
        }

        if (targetSlug) {
          const slugFiltered = results.filter(
            (r) => !r.clinicSlug || String(r.clinicSlug).trim().toLowerCase() === targetSlug
          );
          if (slugFiltered.length > 0) {
            results = slugFiltered;
          }
        }

        results.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
        resolve(results);
      };

      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('[OfflineBookingDB] getOfflineAppointments error:', err);
    return [];
  }
}

export async function clearOfflineAppointmentsForPhone(phone: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const targetPhone = normalizePhoneDigits(phone);
  if (!targetPhone) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: OfflineAppointmentRecord[] = Array.isArray(req.result) ? req.result : [];
        for (const item of items) {
          if (normalizePhoneDigits(item.patientPhone) === targetPhone) {
            store.delete(item.id);
          }
        }
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[OfflineBookingDB] clearOfflineAppointmentsForPhone error:', err);
  }
}

export async function enqueueOfflineBooking(
  input: Omit<PendingOfflineBooking, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'attempts'>
): Promise<PendingOfflineBooking | null> {
  if (!isIndexedDbSupported()) return null;

  const nowIso = new Date().toISOString();
  const id = `offline_queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: PendingOfflineBooking = {
    ...input,
    id,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
    attempts: 0,
    lastError: null,
  };

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      store.put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });

    dispatchOfflineQueueUpdated();

    // Register Background Sync with Service Worker when available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg: any) => {
          if (reg?.sync && typeof reg.sync.register === 'function') {
            return reg.sync.register('sync-pending-bookings');
          }
        })
        .catch(() => {});
    }

    return record;
  } catch (err) {
    console.warn('[OfflineBookingDB] enqueueOfflineBooking error:', err);
    return null;
  }
}

export async function getPendingOfflineBookings(filter?: {
  phone?: string | null;
  clinicSlug?: string | null;
}): Promise<PendingOfflineBooking[]> {
  if (!isIndexedDbSupported()) return [];

  try {
    const db = await openOfflineDb();
    const targetPhone = normalizePhoneDigits(filter?.phone);
    const targetSlug = (filter?.clinicSlug || '').trim().toLowerCase();

    return await new Promise<PendingOfflineBooking[]>((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readonly');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        db.close();
        let results: PendingOfflineBooking[] = Array.isArray(req.result) ? req.result : [];
        if (targetPhone) {
          results = results.filter((r) => normalizePhoneDigits(r.phone) === targetPhone);
        }
        if (targetSlug) {
          const slugFiltered = results.filter(
            (r) => !r.clinicSlug || String(r.clinicSlug).trim().toLowerCase() === targetSlug
          );
          if (slugFiltered.length > 0 || !targetPhone) {
            results = slugFiltered;
          }
        }
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(results);
      };

      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('[OfflineBookingDB] getPendingOfflineBookings error:', err);
    return [];
  }
}

export async function updatePendingOfflineBooking(
  id: string,
  patch: Partial<PendingOfflineBooking>
): Promise<void> {
  if (!isIndexedDbSupported() || !id) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            ...patch,
            updatedAt: new Date().toISOString(),
          });
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    dispatchOfflineQueueUpdated();
  } catch (err) {
    console.warn('[OfflineBookingDB] updatePendingOfflineBooking error:', err);
  }
}

export async function removePendingOfflineBooking(id: string): Promise<void> {
  if (!isIndexedDbSupported() || !id) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PENDING_STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    dispatchOfflineQueueUpdated();
  } catch (err) {
    console.warn('[OfflineBookingDB] removePendingOfflineBooking error:', err);
  }
}

export interface OfflineSyncSummary {
  synced: number;
  conflicts: number;
  failed: number;
  syncedItems: Array<{ queueId: string; appointmentId: string; serviceName: string; startAt: string }>;
}

export async function syncPendingOfflineBookings(
  apiClient: {
    get: (url: string, config?: any) => Promise<any>;
    post: (url: string, data?: any, config?: any) => Promise<any>;
  },
  options?: {
    onSyncedRecord?: (item: PendingOfflineBooking, appointmentData: any) => void;
    includeConflicts?: boolean;
  }
): Promise<OfflineSyncSummary> {
  const summary: OfflineSyncSummary = {
    synced: 0,
    conflicts: 0,
    failed: 0,
    syncedItems: [],
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return summary;
  }

  const queue = await getPendingOfflineBookings();
  const candidates = queue.filter((item) =>
    options?.includeConflicts ? item.status !== 'syncing' : item.status === 'pending' || item.status === 'failed'
  );

  for (const item of candidates) {
    await updatePendingOfflineBooking(item.id, {
      status: 'syncing',
      attempts: (item.attempts || 0) + 1,
    });

    try {
      const primaryServiceId = item.serviceId || (item.serviceIds && item.serviceIds[0]) || '';
      if (!primaryServiceId) {
        await updatePendingOfflineBooking(item.id, {
          status: 'conflict',
          lastError: 'Thiếu thông tin dịch vụ khám để đồng bộ.',
        });
        summary.conflicts++;
        continue;
      }

      let resolvedProviderId = item.providerId || '';
      if (!resolvedProviderId) {
        try {
          const provRes = await apiClient.get('/public/providers', {
            params: {
              ...(item.tenantId ? { tenantId: item.tenantId } : {}),
              ...(item.clinicSlug ? { clinic: item.clinicSlug } : {}),
            },
          });
          const provList = provRes?.data?.data;
          if (Array.isArray(provList) && provList.length > 0) {
            resolvedProviderId = String(provList[0].id);
          }
        } catch {}
      }

      let activeToken = item.sessionToken || '';

      const submitWithHold = async (tokenToUse: string) => {
        return await apiClient.post('/public/appointments', {
          sessionToken: tokenToUse,
          fullName: item.fullName.trim(),
          phone: item.phone.trim(),
          email: item.email ? item.email.trim() : undefined,
          telegramId: item.telegramId ? item.telegramId.trim() : undefined,
          notes: item.notes ? item.notes.trim() : undefined,
          serviceIds: item.serviceIds && item.serviceIds.length > 0 ? item.serviceIds : [primaryServiceId],
          customServiceName: item.customServiceName || undefined,
          tenantId: item.tenantId || undefined,
          clinicSlug: item.clinicSlug || undefined,
          bookingFor: item.bookingFor || 'self',
          isNewProfile: item.isNewProfile,
        });
      };

      const acquireFreshHold = async (): Promise<string> => {
        if (!resolvedProviderId) {
          throw Object.assign(new Error('Không xác định được bác sĩ/ghế khám cho khung giờ này.'), {
            isSlotConflict: true,
          });
        }
        const holdRes = await apiClient.post('/public/appointments/hold', {
          providerId: resolvedProviderId,
          serviceId: primaryServiceId,
          serviceIds: item.serviceIds && item.serviceIds.length > 0 ? item.serviceIds : [primaryServiceId],
          customServiceName: item.customServiceName || undefined,
          startAt: item.startAt,
          endAt: item.endAt,
          tenantId: item.tenantId || undefined,
          clinicSlug: item.clinicSlug || undefined,
        });
        const newToken = holdRes?.data?.data?.sessionToken;
        if (!holdRes?.data?.success || !newToken) {
          throw Object.assign(new Error('Khung giờ này đã được khách khác đặt trong lúc ngoại tuyến.'), {
            isSlotConflict: true,
          });
        }
        return String(newToken);
      };

      let bookRes: any = null;
      if (activeToken) {
        try {
          bookRes = await submitWithHold(activeToken);
        } catch (tokenErr: any) {
          const status = tokenErr?.response?.status;
          const errCode = tokenErr?.response?.data?.error?.code || '';
          const msg = String(tokenErr?.response?.data?.error?.message || tokenErr?.message || '');
          const isHoldProblem =
            status === 400 ||
            status === 404 ||
            errCode.includes('HOLD') ||
            msg.toLowerCase().includes('hold') ||
            msg.toLowerCase().includes('giữ chỗ') ||
            msg.toLowerCase().includes('hết hạn');

          if (isHoldProblem) {
            activeToken = await acquireFreshHold();
            bookRes = await submitWithHold(activeToken);
          } else {
            throw tokenErr;
          }
        }
      } else {
        activeToken = await acquireFreshHold();
        bookRes = await submitWithHold(activeToken);
      }

      if (bookRes?.data?.success && bookRes.data?.data?.appointmentId) {
        const appointmentData = bookRes.data.data;
        await saveSingleOfflineAppointment(
          {
            id: appointmentData.appointmentId,
            startAt: appointmentData.startAt || item.startAt,
            endAt: appointmentData.endAt || item.endAt,
            status: appointmentData.status || 'REQUESTED',
            serviceId: appointmentData.serviceId || primaryServiceId,
            serviceIds: appointmentData.serviceIds || item.serviceIds || [primaryServiceId],
            serviceName: appointmentData.serviceName || item.serviceName || 'Dịch vụ nha khoa',
            providerName: appointmentData.providerName || item.providerName || null,
            patientName: item.fullName.trim(),
            bookingFor: item.bookingFor || 'self',
            notes: item.notes || null,
          },
          {
            phone: item.phone.trim(),
            clinicSlug: item.clinicSlug || null,
            clinicName: item.clinicName || null,
            fullName: item.fullName.trim(),
          }
        );

        try {
          localStorage.setItem(
            'verifiedPatient',
            JSON.stringify({ phone: item.phone.trim(), fullName: item.fullName.trim() })
          );
        } catch {}

        if (options?.onSyncedRecord) {
          options.onSyncedRecord(item, appointmentData);
        }

        await removePendingOfflineBooking(item.id);
        summary.synced++;
        summary.syncedItems.push({
          queueId: item.id,
          appointmentId: appointmentData.appointmentId,
          serviceName: appointmentData.serviceName || item.serviceName,
          startAt: appointmentData.startAt || item.startAt,
        });
      } else {
        throw new Error(bookRes?.data?.message || 'Không thể đồng bộ lịch hẹn.');
      }
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Lỗi kết nối khi đồng bộ lịch hẹn.';

      const isConflict =
        Boolean(err?.isSlotConflict) ||
        httpStatus === 409 ||
        httpStatus === 400 ||
        httpStatus === 422 ||
        String(errMsg).toLowerCase().includes('đã có người') ||
        String(errMsg).toLowerCase().includes('quá khứ') ||
        String(errMsg).toLowerCase().includes('kín lịch');

      await updatePendingOfflineBooking(item.id, {
        status: isConflict ? 'conflict' : 'failed',
        lastError: errMsg,
      });

      if (isConflict) {
        summary.conflicts++;
      } else {
        summary.failed++;
      }
    }
  }

  return summary;
}

