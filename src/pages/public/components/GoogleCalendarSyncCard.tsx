import React, { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Calendar, 
  ExternalLink, 
  Download, 
  Copy, 
  Check, 
  Bell, 
  Smartphone, 
  Clock, 
  MapPin, 
  Sparkles 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  buildGoogleCalendarUrl, 
  downloadIcsFile, 
  formatCalendarDescription,
  CalendarAppointmentDetails 
} from '../../../utils/calendarSync';

interface GoogleCalendarSyncCardProps {
  appointment: CalendarAppointmentDetails;
  className?: string;
  variant?: 'full' | 'compact';
}

export default function GoogleCalendarSyncCard({
  appointment,
  className = '',
  variant = 'full',
}: GoogleCalendarSyncCardProps) {
  const [copied, setCopied] = useState(false);
  const [syncedState, setSyncedState] = useState(false);

  const { startAt, endAt, serviceName, clinicName, address, doctorName } = appointment;

  const isValidDate = startAt && !isNaN(new Date(startAt).getTime());
  const startDate = isValidDate ? new Date(startAt) : null;
  const endDate = endAt && !isNaN(new Date(endAt).getTime()) ? new Date(endAt) : null;

  const googleCalUrl = isValidDate ? buildGoogleCalendarUrl(appointment) : '#';

  const handleCopyDetails = async () => {
    try {
      const text = formatCalendarDescription(appointment);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Đã sao chép chi tiết lịch khám!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Không thể sao chép thông tin');
    }
  };

  const handleDownloadIcs = () => {
    if (!isValidDate) {
      toast.error('Chưa có thông tin thời gian hợp lệ để xuất lịch');
      return;
    }
    downloadIcsFile(appointment);
    toast.success('Đã tải tệp lịch (.ics) về máy');
  };

  const handleOpenGoogleCal = () => {
    if (!isValidDate) {
      toast.error('Chưa có thông tin thời gian hợp lệ');
      return;
    }
    setSyncedState(true);
  };

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <a
          href={googleCalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenGoogleCal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-200"
          title="Thêm vào Google Calendar"
        >
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>Lưu vào Google Calendar</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
        <button
          type="button"
          onClick={handleDownloadIcs}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors border border-slate-200"
          title="Tải tệp iCal (.ics) cho Apple / Outlook"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Tệp .ics</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="google-calendar-sync-card"
      className={`rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/50 p-5 sm:p-6 shadow-lg shadow-blue-500/5 relative overflow-hidden ${className}`}
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-blue-200 shadow-sm flex items-center justify-center shrink-0">
            {/* Google Calendar Quad-color Inspired Icon */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Đồng Bộ Google Calendar
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100/80 text-blue-700 border border-blue-200/60">
                1 Chạm
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động lưu vào lịch cá nhân & nhận thông báo nhắc hẹn trước giờ khám
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
          <Bell className="w-3.5 h-3.5 text-emerald-600" />
          <span>Nhắc tự động trước 24h & 2h</span>
        </div>
      </div>

      {/* Appointment mini preview snippet */}
      {startDate && (
        <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-blue-100 shadow-2xs mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Khung giờ hẹn:
            </span>
            <span className="font-extrabold text-slate-900 text-sm">
              {format(startDate, 'HH:mm', { locale: vi })}
              {endDate ? ` - ${format(endDate, 'HH:mm', { locale: vi })}` : ''} •{' '}
              {format(startDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 font-medium">Dịch vụ: </span>
              <strong className="text-slate-800 font-bold">{serviceName || 'Khám nha khoa'}</strong>
            </div>
            {doctorName && (
              <div>
                <span className="text-slate-400 font-medium">Bác sĩ: </span>
                <strong className="text-slate-800 font-bold">{doctorName}</strong>
              </div>
            )}
            {(clinicName || address) && (
              <div className="sm:col-span-2 flex items-start gap-1 text-[11px] text-slate-500 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="truncate">{address || clinicName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Synced Notification Alert if user clicked */}
      {syncedState && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in-50 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong>Đang mở Google Calendar!</strong>
            <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
              Bạn chỉ cần bấm nút <strong>"Lưu" (Save)</strong> trên trang Google Calendar để hoàn tất. Lịch sẽ tự động đồng bộ sang ứng dụng Google Calendar trên điện thoại và đồng hồ thông minh của bạn.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Primary 1-Click Google Calendar Button */}
        <a
          id="btn-add-google-calendar"
          href={googleCalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenGoogleCal}
          className="flex-1 inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] text-center cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>{syncedState ? 'Mở lại Google Calendar' : 'Thêm vào Google Calendar'}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </a>

        {/* Secondary iCal (.ics) file download */}
        <button
          id="btn-download-ics-calendar"
          type="button"
          onClick={handleDownloadIcs}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          title="Tải tệp .ics hỗ trợ Apple Calendar (iPhone/Mac) hoặc Microsoft Outlook"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Tải file .ics (Apple/Outlook)</span>
        </button>

        {/* Copy details button */}
        <button
          id="btn-copy-calendar-details"
          type="button"
          onClick={handleCopyDetails}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          title="Sao chép toàn bộ thông tin lịch hẹn để dán vào ghi chú / Zalo / tin nhắn"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>

      {/* Helpful footnote */}
      <div className="mt-3 pt-3 border-t border-blue-100/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          Tự động đồng bộ trên điện thoại Android, iPhone, iPad và Laptop
        </span>
        <span className="hidden sm:inline text-slate-400">Không cần cài thêm app</span>
      </div>
    </div>
  );
}
