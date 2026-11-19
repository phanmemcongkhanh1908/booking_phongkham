import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, ShieldCheck, CloudUpload } from 'lucide-react';
import {
  getPendingOfflineBookings,
  OFFLINE_QUEUE_UPDATED_EVENT,
} from '../utils/offlineBookingDb';
import { triggerOfflineQueueSync } from '../utils/offlineQueueSync';

interface SwCacheState {
  active: boolean;
  cachedAssets: number;
}

export const NetworkStatusNotification: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const [restoredSyncCount, setRestoredSyncCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [swState, setSwState] = useState<SwCacheState>({
    active:
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker.controller),
    cachedAssets: 0,
  });

  const refreshQueueCount = useCallback(async () => {
    try {
      const list = await getPendingOfflineBookings();
      const activeCount = list.filter((item) => item.status !== 'conflict').length;
      setPendingCount(activeCount);
    } catch {}
  }, []);

  const checkServiceWorkerStatus = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const controller = navigator.serviceWorker.controller;
      if (!controller) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) {
          setSwState((prev) => ({ ...prev, active: true }));
        }
        return;
      }

      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        setSwState((prev) => ({ ...prev, active: true }));
      }, 600);

      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        if (event.data?.type === 'SW_STATUS') {
          setSwState({
            active: Boolean(event.data.ready),
            cachedAssets: Number(event.data.cachedAssets || 0),
          });
        }
      };
      controller.postMessage({ type: 'GET_SW_STATUS' }, [channel.port2]);
    } catch {}
  }, []);

  useEffect(() => {
    void refreshQueueCount();
    void checkServiceWorkerStatus();

    let restoreTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = async () => {
      setIsOnline(true);
      const syncResult = await triggerOfflineQueueSync({ silent: true });
      setRestoredSyncCount(syncResult?.synced || 0);
      await refreshQueueCount();
      setShowRestored(true);
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => setShowRestored(false), 4500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      void checkServiceWorkerStatus();
      void refreshQueueCount();
    };

    const handleQueueUpdate = () => {
      void refreshQueueCount();
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_CACHE_READY') {
        void checkServiceWorkerStatus();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdate);
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdate);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [refreshQueueCount, checkServiceWorkerStatus]);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok) {
        setIsOnline(true);
        const syncResult = await triggerOfflineQueueSync({ silent: true });
        setRestoredSyncCount(syncResult?.synced || 0);
        await refreshQueueCount();
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 4500);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline && !showRestored) {
    return null;
  }

  if (isOnline && showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 left-0 right-0 z-[200] bg-emerald-600 text-white py-2 px-4 shadow-md flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-bold animate-in slide-in-from-top-full duration-300"
      >
        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
        <span>Đã khôi phục kết nối Internet thành công!</span>
        {restoredSyncCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-md text-xs font-extrabold">
            <CloudUpload className="w-3.5 h-3.5" />
            Đã tự động đồng bộ {restoredSyncCount} lịch hẹn chờ
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 left-0 right-0 z-[200] bg-slate-900 border-b-2 border-amber-400 text-white py-2.5 px-3.5 sm:px-5 shadow-lg flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm animate-in slide-in-from-top-full duration-300"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        <span className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 shrink-0 mt-0.5 sm:mt-0">
          {swState.active ? <ShieldCheck className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </span>
        <div className="min-w-0 leading-snug">
          <div className="flex flex-wrap items-center gap-1.5 font-bold text-amber-200">
            <span>Chế độ ngoại tuyến (Service Worker đang hoạt động)</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-extrabold">
                <CloudUpload className="w-3 h-3" />
                {pendingCount} lịch chờ đồng bộ
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-200 font-normal mt-0.5">
            Bạn vẫn có thể xem lại lịch hẹn đã lưu trên máy và gửi yêu cầu đặt lịch — hệ thống sẽ tự động đồng bộ ngay khi có mạng.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRetryConnection}
        disabled={isChecking}
        className="shrink-0 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95 text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        <span>{isChecking ? 'Đang kiểm tra...' : 'Thử kết nối lại'}</span>
      </button>
    </div>
  );
};
