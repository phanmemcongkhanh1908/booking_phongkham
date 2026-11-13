import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Download, Smartphone, Monitor, X, Share, PlusSquare, Laptop } from 'lucide-react';
import { useBookingStore } from '../../../store/booking';
import { toast } from 'react-hot-toast';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isPC, install, createDesktopShortcut } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<'pc' | 'android' | 'ios'>(isPC ? 'pc' : isIOS ? 'ios' : 'android');
  const clinicProfile = useBookingStore(s => s.clinicProfile);

  // Lock body scroll and inform floating PWAInstallBanner when modal opens/closes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pwa-guide-modal-toggle', { detail: { open: showGuide } }));
    if (!showGuide) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.dispatchEvent(new CustomEvent('pwa-guide-modal-toggle', { detail: { open: false } }));
    };
  }, [showGuide]);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const clinicName = clinicProfile?.clinicName || 'Phòng Khám';

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        toast.success('Ứng dụng đã được cài đặt thành công!');
        return;
      }
    }
    // Set active tab according to user device
    setActiveTab(isPC ? 'pc' : isIOS ? 'ios' : 'android');
    setShowGuide(true);
  };

  const handleCreateDesktop = () => {
    const success = createDesktopShortcut(clinicName);
    if (success) {
      toast.success('Đã tải file Lối tắt Desktop (.url)! Bạn hãy kéo thả file ra Màn hình chính (Desktop) để mở nhanh.');
    } else {
      toast.error('Không thể tạo file lối tắt, vui lòng dùng cách cài đặt qua trình duyệt.');
    }
  };

  const guideModal = showGuide ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-btn-guide-title"
      onClick={() => setShowGuide(false)}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-3xl bg-white shadow-2xl relative border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Fixed Header */}
        <div className="px-5 pt-5 pb-3.5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              {activeTab === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 id="pwa-btn-guide-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                Cài đặt ứng dụng {clinicName}
              </h3>
              <p className="text-xs text-slate-500">
                Mở ứng dụng siêu tốc mọi lúc, không cần quét lại mã QR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(false)}
            aria-label="Đóng hướng dẫn"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900 text-xs uppercase tracking-wide">Cách nhanh nhất (Khuyên dùng):</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tải ngay file lối tắt để đặt trực tiếp ra Màn hình Desktop. Nhấp đúp vào là vào thẳng trang đặt lịch của phòng khám!
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
                <p className="font-bold text-slate-800 text-xs uppercase tracking-wide">Hoặc cài đặt qua trình duyệt (Chrome / Cốc Cốc / Edge):</p>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Biểu tượng cài đặt trên thanh địa chỉ URL</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nhìn vào góc phải thanh địa chỉ trình duyệt, bấm vào biểu tượng <strong>[Cài đặt ứng dụng]</strong> (hình màn hình máy tính có mũi tên xuống).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Hoặc mở Menu (3 chấm dọc ⋮)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bấm Menu góc phải ➔ Chọn <strong>"Lưu và chia sẻ"</strong> hoặc <strong>"Cài đặt ứng dụng..."</strong> ➔ Tạo lối tắt vào Desktop.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content for Android */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              {isInstallable ? (
                <div className="bg-teal-50 p-3.5 rounded-2xl border border-teal-200 space-y-2">
                  <p className="text-xs text-teal-800 font-medium">Thiết bị của bạn hỗ trợ tạo ứng dụng tự động 1 chạm:</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const accepted = await install();
                      if (accepted) {
                        toast.success('Đã thêm ứng dụng ra màn hình chính!');
                        setShowGuide(false);
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tự động tạo ứng dụng ra Màn hình chính</span>
                  </button>
                </div>
              ) : null}

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
            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Bấm biểu tượng Chia sẻ</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Nhấn vào biểu tượng <Share className="w-3.5 h-3.5 text-blue-600 inline align-text-bottom mx-0.5" /> ở thanh công cụ dưới cùng của trình duyệt Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Chọn "Thêm vào MH chính"</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Cuộn xuống và chọn <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline align-text-bottom mx-0.5" /> <strong>"Thêm vào MH chính"</strong> (Add to Home Screen).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Nhấn "Thêm" (Add)</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Biểu tượng phòng khám sẽ xuất hiện ngay trên màn hình chính của iPhone như một App tải từ App Store.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={isPC ? "Cài đặt ứng dụng / Tạo lối tắt Desktop" : "Cài đặt ứng dụng vào điện thoại"}
        className="flex items-center gap-1.5 rounded-xl bg-teal-50 px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold text-teal-800 shadow-2xs border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
      >
        {isPC ? (
          <Monitor className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        )}
        <span className="inline">{isPC ? 'Cài vào PC' : 'Cài App'}</span>
      </button>

      {guideModal && typeof document !== 'undefined' ? createPortal(guideModal, document.body) : null}
    </>
  );
};
