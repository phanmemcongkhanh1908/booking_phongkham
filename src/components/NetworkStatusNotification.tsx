import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';

export const NetworkStatusNotification: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      // Ping health check endpoint with cache busting to test real internet connectivity
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok) {
        setIsOnline(true);
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3000);
      } else {
        setIsOnline(false);
      }
    } catch (err) {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  // If online and not in restored state, render nothing
  if (isOnline && !showRestored) {
    return null;
  }

  // Restored State Banner
  if (isOnline && showRestored) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[200] bg-emerald-600 text-white py-2 px-4 shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm font-bold animate-in slide-in-from-top-full duration-300"
      >
        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
        <span>Đã khôi phục kết nối Internet thành công!</span>
      </div>
    );
  }

  // Offline State Banner with Retry Button
  return (
    <div 
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 text-white py-2.5 px-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-in slide-in-from-top-full duration-300"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="p-1 rounded-lg bg-rose-700/80 animate-pulse shrink-0">
          <WifiOff className="w-4 h-4 text-white" />
        </span>
        <div className="font-semibold leading-tight truncate">
          <span>Bạn đang bị mất kết nối Internet!</span>
          <span className="hidden sm:inline font-normal text-rose-100 text-xs ml-1.5">
            Vui lòng kiểm tra lại mạng Wi-Fi hoặc 4G/5G để tiếp tục.
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRetryConnection}
        disabled={isChecking}
        className="shrink-0 px-3.5 py-1.5 bg-white text-rose-700 hover:bg-rose-50 active:scale-95 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        <span>{isChecking ? 'Đang kiểm tra...' : 'Thử lại kết nối'}</span>
      </button>
    </div>
  );
};
