import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Smartphone, Monitor, Download, X, Share, PlusSquare, Laptop } from 'lucide-react';
import { useBookingStore } from '../../../store/booking';
import { toast } from 'react-hot-toast';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isPC, install, createDesktopShortcut } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [externalModalOpen, setExternalModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pc' | 'android' | 'ios'>(isPC ? 'pc' : isIOS ? 'ios' : 'android');
  const clinicProfile = useBookingStore(s => s.clinicProfile);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setExternalModalOpen(Boolean(detail?.open));
    };
    window.addEventListener('pwa-guide-modal-toggle', handleToggle);
    return () => window.removeEventListener('pwa-guide-modal-toggle', handleToggle);
  }, []);

  useEffect(() => {
    if (!showGuideModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuideModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showGuideModal]);

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
    // Only show on non-installed view
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
        toast.success('Ứng dụng đã được cài đặt thành công!');
        return;
      }
    }
    setActiveTab(isPC ? 'pc' : isIOS ? 'ios' : 'android');
    setShowGuideModal(true);
  };

  const handleCreateDesktop = () => {
    const success = createDesktopShortcut(clinicProfile?.clinicName || 'Dat_Lich_Kham');
    if (success) {
      toast.success('Đã tải file Lối tắt Desktop (.url)! Kéo thả file ra Màn hình chính Desktop để mở nhanh.');
      setIsDismissed(true);
      setShowGuideModal(false);
    }
  };

  const appName = clinicProfile?.clinicName || 'Đặt Lịch Nha Khoa';

  const guideModalContent = showGuideModal ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-banner-guide-title"
      onClick={() => setShowGuideModal(false)}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-3xl bg-white shadow-2xl relative border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Sticky Modal Header */}
        <div className="px-5 pt-5 pb-3.5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              {activeTab === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 id="pwa-banner-guide-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                Cài đặt ứng dụng {appName}
              </h3>
              <p className="text-xs text-slate-500">
                Mở ứng dụng siêu tốc mọi lúc, không cần tìm hay quét mã QR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuideModal(false)}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng hướng dẫn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Platform Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('pc')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'pc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Máy tính PC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'android' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>iPhone / iPad</span>
            </button>
          </div>

          {/* Content for PC */}
          {activeTab === 'pc' && (
            <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-2xl border border-teal-200/80 space-y-2">
                <span className="font-bold text-teal-900 text-xs uppercase tracking-wide">Tự động tạo lối tắt (Khuyên dùng):</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tải ngay file lối tắt để đặt trực tiếp ra Màn hình Desktop máy tính. Nhấp đúp vào là vào thẳng trang đặt lịch của phòng khám!
                </p>
                <button
                  type="button"
                  onClick={handleCreateDesktop}
                  className="w-full mt-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tạo Lối tắt ra Màn hình Desktop (.url)</span>
                </button>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-xs uppercase tracking-wide">Cài đặt trực tiếp qua trình duyệt (Chrome / Cốc Cốc / Edge):</p>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Bấm biểu tượng cài đặt trên thanh địa chỉ</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nhìn vào góc phải thanh địa chỉ trình duyệt, bấm vào biểu tượng <strong>[Cài đặt ứng dụng]</strong> (màn hình có mũi tên xuống).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Hoặc mở Menu góc phải (⋮)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn <strong>"Lưu và chia sẻ"</strong> hoặc <strong>"Cài đặt ứng dụng..."</strong> ➔ Tạo lối tắt ra màn hình Desktop.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content for Android */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              {isInstallable && (
                <div className="bg-teal-50 p-3.5 rounded-2xl border border-teal-200 space-y-2">
                  <p className="text-xs text-teal-800 font-medium">Thiết bị của bạn hỗ trợ tạo ứng dụng tự động 1 chạm:</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const accepted = await install();
                      if (accepted) {
                        toast.success('Đã thêm ứng dụng ra màn hình chính!');
                        setShowGuideModal(false);
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tự động tạo ứng dụng ra Màn hình chính</span>
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Mở Menu trình duyệt Chrome / Cốc Cốc</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nhấn vào biểu tượng <strong>3 chấm dọc (⋮)</strong> ở góc trên bên phải màn hình điện thoại.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Chọn "Cài đặt ứng dụng" hoặc "Thêm vào MH chính"</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hệ thống sẽ tạo biểu tượng ứng dụng độc lập trên màn hình chính của điện thoại.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content for iOS */}
          {activeTab === 'ios' && (
            <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
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
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuideModal(false)}
            className="w-full rounded-2xl bg-slate-900 py-3 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Floating Install Bar / Banner - auto hidden whenever any guide modal is open */}
      {!externalModalOpen && !showGuideModal && (
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
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-full transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
              {isPC 
                ? 'Tạo lối tắt ra màn hình Desktop máy tính để mở nhanh bất cứ lúc nào!'
                : 'Thêm vào màn hình chính điện thoại để mở đặt lịch nhanh các lần sau!'}
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isPC ? 'Tạo lối tắt / Cài vào PC' : 'Cài đặt vào điện thoại'}</span>
              </button>

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

      {/* Step-by-Step Installation Guide Modal (Portalized to body) */}
      {guideModalContent && typeof document !== 'undefined' ? createPortal(guideModalContent, document.body) : null}
    </>
  );
};

