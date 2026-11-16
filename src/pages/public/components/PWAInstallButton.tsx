import React, { useState } from 'react';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { Smartphone, Monitor } from 'lucide-react';
import { useBookingStore } from '../../../store/booking';
import { toast } from 'react-hot-toast';
import { PWAInstallGuideModal } from './PWAInstallGuideModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isPC, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const clinicProfile = useBookingStore((s) => s.clinicProfile);

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
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={isInstallable ? 'Cài đặt ứng dụng trực tiếp ra màn hình' : 'Thêm ứng dụng ra màn hình'}
        className="flex items-center gap-1.5 rounded-xl bg-teal-50 px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold text-teal-800 shadow-2xs border border-teal-200 hover:bg-teal-100 transition cursor-pointer whitespace-nowrap shrink-0"
      >
        {isPC ? (
          <Monitor className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        )}
        <span className="sm:hidden">Thêm ra MH</span>
        <span className="hidden sm:inline">Thêm ứng dụng ra màn hình</span>
      </button>

      <PWAInstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        clinicName={clinicName}
        initialTab={isPC ? 'pc' : isIOS ? 'ios' : 'android'}
      />
    </>
  );
};
