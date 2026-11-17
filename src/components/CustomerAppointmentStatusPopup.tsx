import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarClock,
  MapPin,
  Navigation,
  Phone,
  Stethoscope,
  User,
  X,
  ArrowRight,
  BellRing,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { buildGoogleMapsDirectionsUrl } from '../utils/maps';

export interface CustomerStatusAlertData {
  id: string;
  status: string;
  eventStatus?: string;
  clinicName?: string | null;
  clinicSlug?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceName?: string | null;
  providerName?: string | null;
  patientName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  cancelReason?: string | null;
  isOneHourReminder?: boolean;
}

interface Props {
  alert: CustomerStatusAlertData | null;
  onClose: () => void;
  onOpenLookup: (alert: CustomerStatusAlertData) => void;
}

export default function CustomerAppointmentStatusPopup({ alert, onClose, onOpenLookup }: Props) {
  if (!alert) return null;

  const statusUpper = String(alert.eventStatus || alert.status || '').toUpperCase();
  const isConfirmed = statusUpper === 'CONFIRMED' && !alert.isOneHourReminder;
  const isRescheduled = statusUpper === 'RESCHEDULED' || statusUpper === 'TIME_CHANGED';
  const isCancelled = statusUpper === 'CANCEL_CLINIC' || statusUpper === 'CANCELLED';
  const isReminder = Boolean(alert.isOneHourReminder);

  let headerBg = 'from-teal-700 via-teal-600 to-emerald-600';
  let HeaderIcon = CheckCircle2;
  let badgeLabel = 'Xác nhận lịch hẹn';
  let title = 'Phòng khám đã chốt lịch hẹn của bạn!';
  let subtitle = 'Lịch khám đã được bác sĩ và bộ phận lễ tân xác nhận chính thức.';

  if (isReminder) {
    headerBg = 'from-blue-700 via-blue-600 to-indigo-600';
    HeaderIcon = BellRing;
    badgeLabel = 'Nhắc lịch khám sắp tới';
    title = 'Còn khoảng 1 giờ nữa đến lịch hẹn!';
    subtitle = 'Vui lòng sắp xếp di chuyển để có mặt trước giờ hẹn 5–10 phút.';
  } else if (isRescheduled) {
    headerBg = 'from-amber-600 via-orange-500 to-amber-500';
    HeaderIcon = CalendarClock;
    badgeLabel = 'Điều chỉnh thời gian';
    title = 'Lịch hẹn vừa được cập nhật giờ mới';
    subtitle = 'Phòng khám đã điều chỉnh khung giờ khám cho bạn, vui lòng kiểm tra lại.';
  } else if (isCancelled) {
    headerBg = 'from-rose-600 via-rose-600 to-red-600';
    HeaderIcon = AlertTriangle;
    badgeLabel = 'Thông báo thay đổi lịch';
    title = 'Lịch hẹn đã bị hủy bởi phòng khám';
    subtitle = 'Thành thật xin lỗi quý khách. Bạn có thể chọn khung giờ khác ngay trong 1 chạm.';
  } else if (!isConfirmed) {
    headerBg = 'from-slate-800 via-slate-700 to-teal-900';
    HeaderIcon = BellRing;
    badgeLabel = 'Cập nhật lịch hẹn';
    title = 'Trạng thái lịch hẹn vừa thay đổi';
    subtitle = 'Vui lòng kiểm tra thông tin cập nhật mới nhất bên dưới.';
  }

  let formattedTime = 'Đang cập nhật';
  if (alert.startAt) {
    try {
      const d = new Date(alert.startAt);
      if (!isNaN(d.getTime())) {
        formattedTime = format(d, 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi });
      }
    } catch {}
  }

  const mapsUrl = alert.clinicAddress
    ? buildGoogleMapsDirectionsUrl(alert.clinicAddress, alert.latitude, alert.longitude)
    : alert.latitude && alert.longitude
    ? buildGoogleMapsDirectionsUrl('', alert.latitude, alert.longitude)
    : '';

  return (
    <div
      className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-status-popup-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Top Semantic Header */}
        <div className={`bg-gradient-to-r ${headerBg} p-5 sm:p-6 text-white relative`}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3.5 pr-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 shadow-sm">
              <HeaderIcon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                {badgeLabel}
              </p>
              <h3
                id="customer-status-popup-title"
                className="text-lg sm:text-xl font-extrabold leading-snug text-white mt-0.5"
              >
                {title}
              </h3>
            </div>
          </div>
          <p className="text-xs text-white/90 mt-2.5 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Appointment Summary Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3 text-xs sm:text-sm">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/70">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500">Phòng khám</p>
                <p className="font-bold text-slate-900 truncate">
                  {alert.clinicName || 'Phòng khám Nha khoa'}
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-500 shrink-0 tabular-nums">
                #{alert.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block">Thời gian hẹn</span>
                <span className="font-extrabold text-slate-900 tabular-nums">{formattedTime}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block">Dịch vụ &amp; Bác sĩ</span>
                <span className="font-semibold text-slate-800">
                  {alert.serviceName || 'Khám nha khoa'}
                  {alert.providerName ? ` · ${alert.providerName}` : ''}
                </span>
              </div>
            </div>

            {alert.patientName && (
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="font-medium text-slate-700">
                  Khách hàng: <strong className="text-slate-900">{alert.patientName}</strong>
                </span>
              </div>
            )}

            {isCancelled && alert.cancelReason && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed">
                <strong>Lý do:</strong> {alert.cancelReason}
              </div>
            )}
          </div>

          {/* Location & Hotline Quick Links */}
          {(alert.clinicAddress || alert.clinicPhone) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>Chỉ đường bản đồ</span>
                </a>
              )}
              {alert.clinicPhone && (
                <a
                  href={`tel:${alert.clinicPhone}`}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                >
                  <Phone className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Gọi phòng khám</span>
                </a>
              )}
            </div>
          )}

          {alert.clinicAddress && (
            <p className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-snug px-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{alert.clinicAddress}</span>
            </p>
          )}

          {/* Primary Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              Đã hiểu, đóng
            </button>
            <button
              type="button"
              onClick={() => onOpenLookup(alert)}
              className="w-full sm:flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-teal-900/15 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Xem vé &amp; Quản lý lịch hẹn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
