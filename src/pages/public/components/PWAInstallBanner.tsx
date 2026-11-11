import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Smartphone, Download, X, Share, PlusSquare, ArrowDown, CheckCircle2 } from 'lucide-react';
import { useBookingStore } from '../../../store/booking';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const clinicProfile = useBookingStore(s => s.clinicProfile);

  useEffect(() => {
    // Check if dismissed within last 7 days
    const dismissedTime = localStorage.getItem('pwa_banner_dismissed_at');
    if (dismissedTime) {
      const diffDays = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        setIsDismissed(true);
        return;
      }
    }
    // Only show on non-installed mobile/tablet view
    setIsDismissed(false);
  }, [isInstalled]);

  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setIsDismissed(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const appName = clinicProfile?.clinicName || 'Đặt Lịch Nha Khoa';

  return (
    <>
      {/* Mobile Floating Install Bar / Banner */}
      <aside 
        aria-label="Cài đặt ứng dụng"
        className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-40 bg-white/95 backdrop-blur-md border border-teal-200/90 rounded-2xl shadow-xl p-3.5 animate-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Smartphone className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                Cài đặt ứng dụng {appName}
              </h4>
              <button 
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-full transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
              Thêm vào màn hình chính để mở đặt lịch nhanh các lần sau, không cần tìm quét mã QR!
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Cài đặt vào điện thoại</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Step-by-Step Installation Guide Modal (for iOS Safari or Android Chrome Fallback) */}
      {showGuideModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 id="pwa-guide-title" className="text-base sm:text-lg font-bold text-slate-900">
              {isIOS ? 'Cài đặt trên iPhone / iPad (iOS)' : 'Cài đặt vào màn hình chính'}
            </h3>

            {isIOS ? (
              <div className="mt-4 space-y-3.5 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Nhấn biểu tượng Chia sẻ</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      Bấm vào nút <Share className="w-3.5 h-3.5 text-blue-600 inline" /> ở thanh công cụ phía dưới Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Chọn Thêm vào MH chính</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      Cuộn tìm mục <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" /> <strong>"Thêm vào MH chính"</strong> (Add to Home Screen).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Nhấn "Thêm" (Add)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Biểu tượng ứng dụng sẽ xuất hiện trên màn hình chính như ứng dụng thông thường!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3.5 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Mở Menu trình duyệt</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nhấn vào biểu tượng <strong>3 chấm dọc (⋮)</strong> ở góc trên bên phải trình duyệt Chrome/Cốc Cốc.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Chọn "Cài đặt ứng dụng"</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hoặc chọn <strong>"Thêm vào Màn hình chính"</strong> để tạo biểu tượng ứng dụng.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              Đã hiểu, tôi sẽ làm theo
            </button>
          </div>
        </div>
      )}
    </>
  );
};
