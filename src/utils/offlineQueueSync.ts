import { toast } from 'react-hot-toast';
import api from '../services/api';
import {
  getPendingOfflineBookings,
  OfflineSyncSummary,
  PendingOfflineBooking,
  syncPendingOfflineBookings,
} from './offlineBookingDb';
import {
  CUSTOMER_STATUS_UPDATED_EVENT,
  recordCustomerDeviceBooking,
} from './customerDeviceBookings';

let isSyncRunning = false;
let initialized = false;

export async function triggerOfflineQueueSync(options?: {
  silent?: boolean;
  includeConflicts?: boolean;
}): Promise<OfflineSyncSummary> {
  if (isSyncRunning) {
    return { synced: 0, conflicts: 0, failed: 0, syncedItems: [] };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, conflicts: 0, failed: 0, syncedItems: [] };
  }

  const pending = await getPendingOfflineBookings();
  const actionable = pending.filter((p) =>
    options?.includeConflicts ? p.status !== 'syncing' : p.status === 'pending' || p.status === 'failed'
  );
  if (actionable.length === 0) {
    return { synced: 0, conflicts: 0, failed: 0, syncedItems: [] };
  }

  isSyncRunning = true;
  try {
    const summary = await syncPendingOfflineBookings(api, {
      includeConflicts: options?.includeConflicts,
      onSyncedRecord: (item: PendingOfflineBooking, appointmentData: any) => {
        recordCustomerDeviceBooking({
          id: appointmentData.appointmentId,
          tenantId: appointmentData.tenantId || item.tenantId || null,
          clinicSlug: item.clinicSlug || null,
          clinicName: item.clinicName || null,
          patientPhone: item.phone.trim(),
          patientName: item.fullName.trim(),
          serviceId: appointmentData.serviceId || item.serviceId || null,
          serviceIds: appointmentData.serviceIds || item.serviceIds || null,
          serviceName: appointmentData.serviceName || item.serviceName || null,
          providerName: appointmentData.providerName || item.providerName || null,
          startAt: appointmentData.startAt || item.startAt || null,
          lastKnownStatus: appointmentData.status || 'REQUESTED',
        });
        window.dispatchEvent(
          new CustomEvent(CUSTOMER_STATUS_UPDATED_EVENT, {
            detail: { id: appointmentData.appointmentId, status: appointmentData.status || 'REQUESTED' },
          })
        );
      },
    });

    if (!options?.silent) {
      if (summary.synced > 0) {
        toast.success(`Đã tự động đồng bộ ${summary.synced} lịch hẹn lên hệ thống phòng khám!`, {
          duration: 5000,
        });
      }
      if (summary.conflicts > 0) {
        toast.error(
          `${summary.conflicts} lịch hẹn ngoại tuyến bị trùng giờ hoặc cần chọn lại khung giờ mới.`,
          { duration: 6000 }
        );
      }
    }

    return summary;
  } finally {
    isSyncRunning = false;
  }
}

export function initOfflineQueueAutoSync(): () => void {
  if (typeof window === 'undefined' || initialized) {
    return () => {};
  }
  initialized = true;

  const runQuiet = () => {
    if (navigator.onLine) {
      void triggerOfflineQueueSync({ silent: false });
    }
  };

  // Run shortly after initial load in case browser came back online before app opened
  const bootTimer = setTimeout(runQuiet, 1500);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      runQuiet();
    }
  };

  const handleSwMessage = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_PENDING_BOOKINGS') {
      runQuiet();
    }
  };

  window.addEventListener('online', runQuiet);
  window.addEventListener('focus', runQuiet);
  document.addEventListener('visibilitychange', handleVisibility);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
  }

  return () => {
    initialized = false;
    clearTimeout(bootTimer);
    window.removeEventListener('online', runQuiet);
    window.removeEventListener('focus', runQuiet);
    document.removeEventListener('visibilitychange', handleVisibility);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  };
}
