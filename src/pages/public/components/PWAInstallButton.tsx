import React, { useState } from 'react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Download, Smartphone, X, Share, PlusSquare } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Cài đặt ứng dụng vào điện thoại"
        className="flex items-center gap-1.5 rounded-xl bg-teal-50 px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold text-teal-800 shadow-2xs border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span className="inline">Cài App</span>
      </button>

      {showGuide && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {isIOS ? 'Cài đặt trên iPhone / iPad (iOS)' : 'Cài đặt vào màn hình chính'}
            </h3>

            {isIOS ? (
              <div className="mt-4 space-y-3 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Nhấn biểu tượng Chia sẻ</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      Bấm vào nút <Share className="w-3.5 h-3.5 text-blue-600 inline" /> ở thanh công cụ phía dưới Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Chọn Thêm vào MH chính</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      Cuộn tìm mục <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" /> <strong>"Thêm vào MH chính"</strong> (Add to Home Screen).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Nhấn "Thêm" (Add)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ứng dụng sẽ được thêm vào màn hình chính để mở nhanh bất cứ lúc nào!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Mở Menu trình duyệt</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nhấn vào biểu tượng <strong>3 chấm dọc (⋮)</strong> ở góc trên bên phải trình duyệt Chrome/Cốc Cốc.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
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
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-colors"
            >
              Đóng hướng dẫn
            </button>
          </div>
        </div>
      )}
    </>
  );
};
