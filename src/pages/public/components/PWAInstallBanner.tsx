import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Smartphone, Monitor, Download, X } from 'lucide-react';
import { useBookingStore } from '../../../store/booking';
import { toast } from 'react-hot-toast';
import { PWAInstallGuideModal } from './PWAInstallGuideModal';

export const PWAInstallBanner: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isPC,
    isInAppBrowser,
    isInstallRequestedFromUrl,
    install,
    downloadBatAutoShortcutScript,
    openInAndroidChrome,
  } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [externalModalOpen, setExternalModalOpen] = useState(false);
  const [customA2hsVisible, setCustomA2hsVisible] = useState(false);
  const clinicProfile = useBookingStore((s) => s.clinicProfile);
  const directApkUrl = clinicProfile?.directApkUrl?.trim() || '';

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setExternalModalOpen(Boolean(detail?.open));
    };
    const handleCustomA2hsVisibility = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCustomA2hsVisible(Boolean(detail?.visible));
    };
    window.addEventListener('pwa-guide-modal-toggle', handleToggle);
    window.addEventListener('pwa-custom-a2hs-visibility', handleCustomA2hsVisibility);
    return () => {
      window.removeEventListener('pwa-guide-modal-toggle', handleToggle);
      window.removeEventListener('pwa-custom-a2hs-visibility', handleCustomA2hsVisibility);
    };
  }, []);

  useEffect(() => {
    if (isInstallRequestedFromUrl && !isInstalled) {
      setIsDismissed(false);
      return;
    }
    const dismissedTime = localStorage.getItem('pwa_banner_dismissed_at');
    if (dismissedTime) {
      const diffDays = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        setIsDismissed(true);
        return;
      }
    }
    setIsDismissed(false);
  }, [isInstalled, isInstallRequestedFromUrl]);

  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (isAndroid && isInAppBrowser) {
      setShowGuideModal(true);
      return;
    }
    if (isInstallable) {
      const success = await install();
      if (success) {
        setIsDismissed(true);
        toast.success('Ứng dụng đã được cài đặt thành công!');
        return;
      }
    }
    setShowGuideModal(true);
  };

  const appName = clinicProfile?.clinicName || 'Đặt Lịch Nha Khoa';

  const handleQuickPcBatDownload = () => {
    const ok = downloadBatAutoShortcutScript(appName);
    if (ok) {
      toast.success(
        'Đang tải file Cài đặt nhanh (.bat). Nhấp đúp file vừa tải để tự động tạo lối tắt trên màn hình PC!',
        { duration: 5000 }
      );
      setIsDismissed(true);
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {!externalModalOpen && !showGuideModal && !customA2hsVisible && (
        <aside
          aria-label="Cài đặt ứng dụng"
          className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-40 bg-white/95 backdrop-blur-md border border-teal-200/90 rounded-2xl shadow-xl p-3.5 animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              {isPC ? <Monitor className="w-5 h-5 text-white" /> : <Smartphone className="w-5 h-5 text-white" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {isPC ? `Cài nhanh ứng dụng ${appName}` : `Cài ứng dụng ${appName}`}
                </h4>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-full transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                {isPC
                  ? 'Cài ứng dụng trực tiếp hoặc tải file .bat tự động tạo lối tắt ra màn hình PC.'
                  : isAndroid && isInAppBrowser
                  ? 'Mở bằng Google Chrome để cài App Android chính chủ và nhận thông báo đẩy.'
                  : directApkUrl && isAndroid
                  ? 'Cài App 1 chạm qua Chrome hoặc tải trực tiếp tệp cài đặt (.APK) về Android!'
                  : 'Thêm vào màn hình chính điện thoại để mở đặt lịch nhanh các lần sau!'}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {isAndroid && isInAppBrowser ? (
                  <button
                    type="button"
                    onClick={() => openInAndroidChrome()}
                    className="flex-1 min-w-[165px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span>Mở bằng Chrome để cài App</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="flex-1 min-w-[165px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>{isAndroid && isInstallable ? 'Cài App Android ngay' : 'Thêm ứng dụng ra màn hình'}</span>
                  </button>
                )}

                {isAndroid && directApkUrl && (
                  <a
                    href={directApkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    onClick={() => {
                      toast.success('Đang tải file .APK về điện thoại Android!', { duration: 4000 });
                      setIsDismissed(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>Tải APK</span>
                  </a>
                )}

                {isPC && (
                  <button
                    type="button"
                    onClick={handleQuickPcBatDownload}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                    title="Tải script .bat tự động tạo icon lối tắt trên Desktop Windows"
                  >
                    <Monitor className="w-3.5 h-3.5 shrink-0" />
                    <span>Cài đặt nhanh trên PC</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      <PWAInstallGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        clinicName={appName}
        initialTab={isPC ? 'pc' : isIOS ? 'ios' : 'android'}
        onInstalledOrCreated={() => {
          setIsDismissed(true);
          setShowGuideModal(false);
        }}
      />
    </>
  );
};
