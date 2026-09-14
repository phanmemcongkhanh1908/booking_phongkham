import React, { useState } from 'react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Download, MonitorSmartphone } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Cài đặt ứng dụng"
        className="hidden sm:flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-[12px] font-bold text-teal-700 shadow-sm border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        Tải App / Cài đặt PC
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Cài đặt ứng dụng trên iPhone"
          className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
        >
          <MonitorSmartphone className="w-3.5 h-3.5" />
          Cài App (iOS)
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-slate-900">Cài đặt trên iPhone / iPad</h3>
              <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">
                1. Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh công cụ Safari.<br /><br />
                2. Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-[13px] font-bold text-slate-800 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Đóng hướng dẫn
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
