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

const DB_NAME = 'dental_smart_offline_v1';
const DB_VERSION = 1;
const STORE_NAME = 'appointments';

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
