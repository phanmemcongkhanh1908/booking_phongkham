import React, { useEffect, useState, useCallback } from 'react';
import { Download, Smartphone, Monitor, X, Zap, WifiOff, BellRing, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBookingStore } from '../store/booking';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'pwa_custom_a2hs_dismissed_at';
const SESSION_DISMISS_KEY = 'pwa_a2hs_dismissed_session';
const DISMISS_COOLDOWN_DAYS = 3;

function checkIsStandaloneMode(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectDeviceKind(): { isAndroid: boolean; isIOS: boolean; isPC: boolean; label: 'ios' | 'android' | 'pc' } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isAndroid: false, isIOS: false, isPC: true, label: 'pc' };
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isPC = !isIOS && !isAndroid;
  const label: 'ios' | 'android' | 'pc' = isIOS ? 'ios' : isAndroid ? 'android' : 'pc';
  return { isAndroid, isIOS, isPC, label };
}

function checkWasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const installParam = (params.get('install') || '').toLowerCase();
    if (['android', 'app', '1', 'true'].includes(installParam)) {
      return false;
    }
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') {
      return true;
    }
    const rawTs = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!rawTs) return false;
    const parsedTs = parseInt(rawTs, 10);
    if (!Number.isFinite(parsedTs)) return false;
    const diffDays = (Date.now() - parsedTs) / (1000 * 60 * 60 * 24);
    return diffDays < DISMISS_COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

function reportNativePwaInstall(platformLabel: 'ios' | 'android' | 'pc') {
  try {
    fetch('/api/public/pwa-install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: platformLabel,
        displayMode: 'standalone',
        installedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}

export const AddToHomeScreenPrompt: React.FC = () => {
  const clinicName = useBookingStore((s) => s.clinicProfile?.clinicName);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandaloneMode());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__deferredPwaPrompt) {
      return (window as any).__deferredPwaPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(() => checkWasRecentlyDismissed());
  const [isPrompting, setIsPrompting] = useState(false);
  const [externalModalOpen, setExternalModalOpen] = useState(false);

  const device = detectDeviceKind();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStandalone = () => {
      setIsStandalone(checkIsStandaloneMode());
    };
    updateStandalone();

    // Sync any prompt captured before React mounted
    if ((window as any).__deferredPwaPrompt) {
      setDeferredPrompt((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent);
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => updateStandalone();
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    // Primary listener specified: 'pwa-installprompt-ready' dispatched by main.tsx
    const handlePwaPromptReady = () => {
      const captured = (window as any).__deferredPwaPrompt as BeforeInstallPromptEvent | null;
      if (captured) {
        setDeferredPrompt(captured);
      }
    };

    // Fallback in case another browser context fires beforeinstallprompt after mount
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      (window as any).__deferredPwaPrompt = null;
      const isAdminPath =
        window.location.pathname.startsWith('/admin') ||
        window.location.pathname.endsWith('/login');
      if (isAdminPath) {
        localStorage.setItem('pwa_admin_mode', '1');
      } else {
        localStorage.removeItem('pwa_admin_mode');
      }
      localStorage.setItem('pwa_install_reported', 'true');
      reportNativePwaInstall(device.label);
      toast.success('Đã thêm ứng dụng ra màn hình chính thành công!');
    };

    const handleGuideModalToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setExternalModalOpen(Boolean(detail?.open));
    };

    window.addEventListener('pwa-installprompt-ready', handlePwaPromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-guide-modal-toggle', handleGuideModalToggle);

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('pwa-installprompt-ready', handlePwaPromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-guide-modal-toggle', handleGuideModalToggle);
    };
  }, [device.label]);

  const shouldRender = !isStandalone && !isDismissed && !externalModalOpen && Boolean(deferredPrompt);

  // Coordinate with PWAInstallBanner so we never render overlapping bottom prompts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('pwa-custom-a2hs-visibility', { detail: { visible: shouldRender } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('pwa-custom-a2hs-visibility', { detail: { visible: false } })
      );
    };
  }, [shouldRender]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const handleInstallClick = useCallback(async () => {
    const promptEvent =
      deferredPrompt || ((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent | null);
    if (!promptEvent || isPrompting) return;

    setIsPrompting(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).__deferredPwaPrompt = null;
        setIsStandalone(true);
        const isAdminPath =
          window.location.pathname.startsWith('/admin') ||
          window.location.pathname.endsWith('/login');
        if (isAdminPath) {
          localStorage.setItem('pwa_admin_mode', '1');
        } else {
          localStorage.removeItem('pwa_admin_mode');
        }
        reportNativePwaInstall(device.label);
        toast.success('Đang cài đặt ứng dụng lên màn hình chính...');
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.warn('[PWA] Add to Home Screen prompt failed or cancelled:', err);
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt, isPrompting, device.label, handleDismiss]);

  if (!shouldRender) {
    return null;
  }

  const displayTitle = clinicName?.trim() || 'Dental Smart Booking';

  return (
    <aside
      role="dialog"
      aria-label="Thêm ứng dụng vào màn hình chính"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[400px] z-[120] rounded-2xl bg-white/95 backdrop-blur-md border border-teal-200 shadow-2xl shadow-slate-900/15 overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            {device.isPC ? (
              <Monitor className="w-5 h-5" />
            ) : (
              <Smartphone className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  Cài đặt ứng dụng PWA
                </p>
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {displayTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Đóng thông báo cài đặt"
                className="p-1 -mt-1 -mr-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Thêm ra màn hình chính để mở nhanh như ứng dụng gốc, xem lịch hẹn khi mất mạng và nhận thông báo nhắc lịch.
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                <Zap className="w-3 h-3 text-amber-500" />
                Mở 1 chạm
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                <WifiOff className="w-3 h-3 text-teal-600" />
                Chạy Offline
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                <BellRing className="w-3 h-3 text-indigo-600" />
                Nhắc hẹn 24h
              </span>
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isPrompting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {isPrompting ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 animate-pulse shrink-0" />
                    <span>Đang mở hộp thoại...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Thêm vào màn hình chính</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AddToHomeScreenPrompt;
