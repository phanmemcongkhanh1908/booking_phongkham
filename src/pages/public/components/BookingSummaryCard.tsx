import React from 'react';
import { useBookingStore } from '../../../store/booking';
import { 
  ShieldCheck, 
  Clock, 
  Calendar, 
  UserCheck, 
  MapPin, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  Lock,
  Stethoscope,
  HeartHandshake
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface BookingSummaryCardProps {
  currentStep: number;
}

export default function BookingSummaryCard({ currentStep }: BookingSummaryCardProps) {
  const { 
    serviceName, 
    servicePrice, 
    serviceDuration, 
    slotStartTime, 
    providerName, 
    clinicProfile,
    holdExpiresAt 
  } = useBookingStore();

  const clinicName = clinicProfile?.clinicName || 'Dental Smart Clinic';
  const doctorName = providerName || clinicProfile?.doctorName || 'Bác sĩ chuyên khoa';
  const phone = clinicProfile?.phone;
  const address = clinicProfile?.address;
  const slogan = clinicProfile?.slogan;

  // Calculate hold time remaining if on step 3
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  React.useEffect(() => {
    if (!holdExpiresAt || currentStep !== 3) return;
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

  return (
    <aside className="w-full lg:w-80 xl:w-90 shrink-0 space-y-4">
      {/* Main Summary Ticket Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 overflow-hidden transition-all duration-300">
        {/* Card Header with Hospital/Clinic branding */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-400/15 text-teal-300 border border-teal-400/20 mb-1.5">
                <Sparkles className="w-3 h-3 text-teal-300" />
                Phiếu Đặt Hẹn
              </span>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white leading-snug">
                {clinicName}
              </h3>
              {slogan && (
                <p className="text-xs text-slate-300/80 italic mt-0.5 line-clamp-1">
                  “{slogan}”
                </p>
              )}
            </div>
            
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-teal-300 shrink-0 border border-white/10">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>

          {/* Real-time Hold Timer on step 3 */}
          {currentStep === 3 && holdExpiresAt && (
            <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-teal-200 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Đang giữ chỗ riêng:
              </span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                timeLeft < 60 ? 'bg-red-500/30 text-red-200 animate-pulse' : 'bg-teal-500/20 text-teal-100'
              }`}>
                {minutes}:{seconds < 10 ? '0' : ''}{seconds}
              </span>
            </div>
          )}
        </div>

        {/* Selected Details Stream */}
        <div className="p-4 sm:p-5 space-y-4 divide-y divide-slate-100 text-sm">
          {/* Service Item */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Dịch vụ khám</span>
              <span className="text-teal-600 font-bold">Bước 1</span>
            </div>
            {serviceName ? (
              <div className="flex items-start justify-between gap-2 pt-0.5">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug">
                    {serviceName}
                  </h4>
                  {serviceDuration && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Thời lượng ước tính: ~{serviceDuration} phút
                    </p>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg border border-teal-100 shrink-0">
                  {formattedPrice}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic pt-1">
                Vui lòng chọn dịch vụ khám ở bảng bên trái
              </p>
            )}
          </div>

          {/* Date & Time Item */}
          <div className="pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Lịch hẹn & Bác sĩ</span>
              <span className="text-teal-600 font-bold">Bước 2</span>
            </div>
            {slotStartTime ? (
              <div className="space-y-2 pt-0.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    {format(new Date(slotStartTime), 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
                  <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Bác sĩ: <strong>BS. {doctorName}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic pt-1">
                {currentStep === 1 ? 'Chọn dịch vụ để mở khóa ngày giờ' : 'Đang chờ chọn ngày và giờ khám'}
              </p>
            )}
          </div>

          {/* Location & Support */}
          {(address || phone) && (
            <div className="pt-3 space-y-2 text-xs text-slate-600">
              {address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{address}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Hotline đặt hẹn: <a href={`tel:${phone}`} className="font-bold text-teal-700 hover:underline">{phone}</a></span>
                </div>
              )}
            </div>
          )}

          {/* Price Breakdown / Transparent Guarantee */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Phí dịch vụ:</span>
              <span className="font-medium text-slate-700">{formattedPrice}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Phí giữ chỗ & đặt hẹn:</span>
              <span className="font-bold text-emerald-600">0đ (Miễn phí)</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold text-sm text-slate-900">
              <span>Tổng thanh toán dự kiến:</span>
              <span className="text-base text-teal-700 font-extrabold">{formattedPrice}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal pt-1">
              * Thanh toán tại phòng khám sau khi hoàn tất dịch vụ. Cam kết không phụ thu phí ẩn.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Medical Standards Badges */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          Cam kết dịch vụ chuẩn y khoa
        </h4>
        <ul className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
            <span><strong>Đúng hẹn 100%:</strong> Ưu tiên vào khám ngay khi đến theo giờ đã đặt.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
            <span><strong>Bác sĩ chính quy:</strong> Trực tiếp tư vấn và thực hiện thủ thuật.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
            <span><strong>Đổi lịch linh hoạt:</strong> Dễ dàng dời hoặc hủy lịch miễn phí.</span>
          </li>
          <li className="flex items-start gap-2">
            <HeartHandshake className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
            <span><strong>Bảo mật thông tin:</strong> Tuân thủ an toàn dữ liệu y tế.</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}
