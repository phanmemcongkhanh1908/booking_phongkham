import React, { useState } from 'react';
import { useBookingStore } from '../../../store/booking';
import { 
  Clock, 
  Calendar, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  MapPin, 
  Phone,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MobileSummaryDrawerProps {
  currentStep: number;
}

export default function MobileSummaryDrawer({ currentStep }: MobileSummaryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const serviceName = useBookingStore(s => s.serviceName);
  const servicePrice = useBookingStore(s => s.servicePrice);
  const serviceDuration = useBookingStore(s => s.serviceDuration);
  const slotStartTime = useBookingStore(s => s.slotStartTime);
  const providerName = useBookingStore(s => s.providerName);
  const clinicProfile = useBookingStore(s => s.clinicProfile);
  const holdExpiresAt = useBookingStore(s => s.holdExpiresAt);
  const bookingFormConfig = useBookingStore(s => s.bookingFormConfig);

  const showHoldCountdown = bookingFormConfig?.showHoldCountdown !== false;

  const clinicName = clinicProfile?.clinicName || 'Dental Smart Clinic';
  const doctorName = providerName || clinicProfile?.doctorName || 'Bác sĩ chuyên khoa';
  const phone = clinicProfile?.phone;
  const address = clinicProfile?.address;

  // Real-time hold timer for step 3 and 4
  const [timeLeft, setTimeLeft] = useState<number>(0);
  React.useEffect(() => {
    if (!holdExpiresAt || currentStep < 3) return;
    const calc = () => Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt, currentStep]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const formattedPrice = servicePrice && Number(servicePrice) > 0 
    ? `${Number(servicePrice).toLocaleString('vi-VN')}đ` 
    : 'Miễn phí';

  // Only show when at least a service is selected and not in step 5
  if (!serviceName || currentStep >= 5) return null;

  return (
    <div className="lg:hidden w-full rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden transition-all">
      {/* Tap Bar to toggle preview */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-left bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-100/80 text-teal-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/50">
                Đang chọn
              </span>
              <p className="text-xs font-extrabold text-slate-900 truncate">
                {serviceName}
              </p>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {slotStartTime 
                ? format(new Date(slotStartTime), 'HH:mm • EEEE, dd/MM', { locale: vi })
                : 'Đang chọn ngày giờ'} • <strong className="text-teal-800">{formattedPrice}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2 text-slate-400">
          <span className="text-[11px] font-semibold text-slate-500">
            {isOpen ? 'Thu gọn' : 'Chi tiết'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Accordion Drawer */}
      {isOpen && (
        <div className="p-4 border-t border-slate-100 space-y-3.5 bg-white text-xs text-slate-700 animate-in slide-in-from-top-2 duration-200">
          {/* Service & Price details */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Dịch vụ:</span>
              <p className="font-bold text-slate-900">{serviceName}</p>
              {serviceDuration && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Thời lượng ước tính: ~{serviceDuration} phút
                </p>
              )}
            </div>
            <span className="text-xs font-black text-teal-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200/60">
              {formattedPrice}
            </span>
          </div>

          {/* Time & Doctor */}
          {slotStartTime && (
            <div className="pb-2 border-b border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Lịch khám:</span>
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                {format(new Date(slotStartTime), 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi })}
              </p>
              <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                Bác sĩ phụ trách: <strong>BS. {doctorName}</strong>
              </p>
            </div>
          )}

          {/* Hold time notice (Controlled by Admin Config) */}
          {showHoldCountdown && currentStep === 3 && holdExpiresAt && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-teal-50/80 border border-teal-200/70 text-teal-900">
              <span className="flex items-center gap-1.5 font-medium text-[11px]">
                <Lock className="w-3.5 h-3.5 text-teal-700" />
                Đang giữ chỗ riêng:
              </span>
              <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded-md border border-teal-200">
                {minutes}:{seconds < 10 ? '0' : ''}{seconds}
              </span>
            </div>
          )}

          {/* Location info */}
          {address && (
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{address}</span>
            </div>
          )}

          {/* Medical Trust Badges */}
          <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60">
              <ShieldCheck className="w-3 h-3 text-teal-600" /> Khám đúng giờ hẹn
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60">
              <ShieldCheck className="w-3 h-3 text-teal-600" /> Không phụ thu phí ẩn
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
