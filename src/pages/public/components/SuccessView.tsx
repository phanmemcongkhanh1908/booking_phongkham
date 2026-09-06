import React, { useEffect, useRef, useState } from 'react';
import { useBookingStore } from '../../../store/booking';
import { 
  CheckCircle2, 
  Download, 
  Mail, 
  Send, 
  Bell, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Calendar as CalendarIcon, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  Sparkles,
  ShieldCheck,
  Stethoscope,
  Share2,
  CalendarPlus
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { format, addMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '../../../services/api';
import { useNavigate } from 'react-router-dom';

export default function SuccessView() {
  const { 
    reset, 
    appointmentId, 
    patientName, 
    patientPhone, 
    patientEmail, 
    serviceName, 
    serviceDuration,
    slotStartTime, 
    providerName,
    clinicProfile,
    telegramBotUsername 
  } = useBookingStore();

  const navigate = useNavigate();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [emailInput, setEmailInput] = useState(patientEmail || '');
  const [emailSent, setEmailSent] = useState(Boolean(patientEmail));
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState(patientEmail ? `Email xác nhận và vé khám điện tử đã được gửi tới: ${patientEmail}` : '');

  const [telegramLinked, setTelegramLinked] = useState(false);
  const [botUsername, setBotUsername] = useState(telegramBotUsername || '');

  const clinicName = clinicProfile?.clinicName || 'Dental Smart Clinic';
  const doctorName = providerName || clinicProfile?.doctorName || 'Bác sĩ chuyên khoa';
  const phone = clinicProfile?.phone;
  const address = clinicProfile?.address;

  useEffect(() => {
    if (!botUsername) {
      api.get('/public/clinic-info').then(res => {
        if (res.data.data?.telegramBotUsername) {
          setBotUsername(res.data.data.telegramBotUsername);
        }
      }).catch(console.error);
    }

    if ('Notification' in window && navigator.serviceWorker) {
      Notification.requestPermission().catch(() => {});
    }
  }, [botUsername]);

  const handleDownloadTicket = async () => {
    if (ticketRef.current) {
      try {
        const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2.5 });
        const link = document.createElement('a');
        link.download = `ve-kham-dental-${appointmentId || 'booking'}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Error generating ticket image:', err);
      }
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !appointmentId) return;

    setEmailLoading(true);
    setEmailMsg('');
    try {
      const res = await api.post(`/public/appointments/${appointmentId}/notify`, {
        email: emailInput.trim(),
        phone: patientPhone,
      });
      if (res.data.success) {
        setEmailSent(true);
        setEmailMsg(`Đã gửi thành công email xác nhận lịch khám tới ${emailInput.trim()}!`);
      }
    } catch (err: any) {
      setEmailMsg(err.response?.data?.error?.message || 'Có lỗi khi gửi email. Vui lòng thử lại sau.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Google Calendar Link generator
  const getGoogleCalendarUrl = () => {
    if (!slotStartTime) return '#';
    const startDate = new Date(slotStartTime);
    const endDate = addMinutes(startDate, serviceDuration || 45);

    const formatCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const dates = `${formatCalDate(startDate)}/${formatCalDate(endDate)}`;
    const title = encodeURIComponent(`Khám răng: ${serviceName || 'Nha khoa'} - ${clinicName}`);
    const details = encodeURIComponent(
      `Lịch hẹn khám nha khoa tại ${clinicName}\nBác sĩ phụ trách: ${doctorName}\nBệnh nhân: ${patientName} (${patientPhone})\nMã hẹn: #${appointmentId?.slice(0, 8).toUpperCase()}`
    );
    const location = encodeURIComponent(address || clinicName);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  const telegramLink = botUsername && appointmentId 
    ? `https://t.me/${botUsername}?start=apt_${appointmentId}`
    : 'https://t.me';

  const qrData = JSON.stringify({ type: 'checkin', id: appointmentId });

  const handleNewBooking = () => {
    reset();
    navigate('/book/dich-vu');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Top Reassurance Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-teal-600 to-emerald-500 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-teal-900/20 mb-4 animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Tiếp nhận thành công
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Đặt Lịch Khám Thành Công!
        </h2>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
          Phòng khám đã xác nhận giữ chỗ cho bạn. Thẻ hẹn điện tử dưới đây có thể dùng để check-in trực tiếp tại quầy lễ tân.
        </p>

        {/* Quick Calendar Button */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={getGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition-colors shadow-2xs"
          >
            <CalendarPlus className="w-4 h-4 text-teal-700" />
            <span>Thêm vào Google Calendar</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {appointmentId && (
            <button
              type="button"
              onClick={handleDownloadTicket}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors border border-teal-200"
            >
              <Download className="w-4 h-4 text-teal-700" />
              <span>Tải thẻ khám điện tử (Ảnh)</span>
            </button>
          )}
        </div>
      </div>

      {/* Luxury Digital E-Ticket */}
      {appointmentId && (
        <div 
          ref={ticketRef} 
          className="w-full rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-200/60 overflow-hidden relative"
        >
          {/* Ticket Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
            <div className="relative z-10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 bg-teal-400/15 px-3 py-1 rounded-full border border-teal-400/20">
                Thẻ Tiếp Đón Điện Tử • E-Ticket
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white pt-1">
                {clinicName}
              </h3>
              <p className="text-xs text-slate-300 font-mono">
                Mã tiếp nhận: <strong className="text-teal-300 font-bold tracking-wider">#{appointmentId.slice(0, 8).toUpperCase()}</strong>
              </p>
            </div>
          </div>

          {/* Ticket Details Grid */}
          <div className="p-6 sm:p-7 space-y-5 text-left border-b border-dashed border-slate-300 relative">
            {/* Cutout notches left and right */}
            <div className="absolute -bottom-3.5 -left-3.5 w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80 shadow-inner" />
            <div className="absolute -bottom-3.5 -right-3.5 w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80 shadow-inner" />

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Patient */}
              <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <User className="w-3 h-3 text-teal-600" />
                  Bệnh nhân
                </span>
                <p className="font-extrabold text-slate-900 text-base">{patientName}</p>
                <p className="text-xs text-slate-500 font-medium">{patientPhone}</p>
              </div>

              {/* Doctor */}
              <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Stethoscope className="w-3 h-3 text-teal-600" />
                  Bác sĩ phụ trách
                </span>
                <p className="font-extrabold text-slate-900 text-base">BS. {doctorName}</p>
                <p className="text-xs text-teal-700 font-semibold">Khám & Điều trị trực tiếp</p>
              </div>
            </div>

            {/* Service & Time */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start justify-between gap-3 bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Dịch vụ đã chọn
                  </span>
                  <p className="font-bold text-slate-900 text-sm sm:text-base">{serviceName}</p>
                  {serviceDuration && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Thời gian dự kiến: ~{serviceDuration} phút
                    </p>
                  )}
                </div>
              </div>

              {/* Scheduled Date */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                    Thời gian hẹn chính thức
                  </span>
                  <p className="font-extrabold text-white text-base sm:text-lg">
                    {slotStartTime 
                      ? format(new Date(slotStartTime), 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi }) 
                      : 'Đang xác nhận'}
                  </p>
                </div>
              </div>

              {/* Location info */}
              {address && (
                <div className="flex items-start gap-2 text-xs text-slate-600 px-1 pt-1">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{address}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code Express Check-in Section */}
          <div className="p-6 bg-slate-50/90 flex flex-col items-center justify-center text-center space-y-3">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/80">
              <QRCodeCanvas value={qrData} size={128} level="M" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Mã Quét Ưu Tiên Tại Quầy Lễ Tân
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">
                Đưa mã này cho nhân viên lễ tân khi đến phòng khám để được hướng dẫn vào phòng khám ngay mà không phải bốc số.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Automated Notification Channels */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md shadow-slate-200/30 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Bell className="w-4 h-4 text-teal-700" />
          Kênh nhận thông báo xác nhận & nhắc hẹn tự động
        </h3>

        {/* Email Channel */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-teal-700 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Xác nhận qua Email</p>
                <p className="text-xs text-slate-500">Nhận thư xác nhận chi tiết & vé khám điện tử</p>
              </div>
            </div>
            {emailSent && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Đã kết nối
              </span>
            )}
          </div>

          {emailMsg && (
            <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-medium">
              {emailMsg}
            </p>
          )}

          <form onSubmit={handleSendEmail} className="flex gap-2">
            <input 
              type="email" 
              placeholder="Nhập địa chỉ email của bạn..." 
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="text-xs sm:text-sm h-10 px-3.5 rounded-xl border border-slate-200 bg-white flex-1 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              required
            />
            <button 
              type="submit" 
              disabled={emailLoading || !emailInput}
              className="px-4 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {emailLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (emailSent ? 'Gửi lại vé' : 'Gửi email')}
            </button>
          </form>
        </div>

        {/* Telegram Channel */}
        <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Nhắc hẹn qua Telegram</p>
                <p className="text-xs text-slate-500">Nhận tin nhắn nhắc lịch tự động trước 24h & 2h</p>
              </div>
            </div>
          </div>

          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setTelegramLinked(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-[#229ED9] hover:bg-[#1E88E5] rounded-xl transition shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{telegramLinked ? "Mở Telegram kiểm tra tin nhắn xác nhận" : "Kích hoạt nhận thông báo Telegram (1 chạm)"}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* Preparation Notes for Patients */}
      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 sm:p-6 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          Lưu ý trước khi đến khám
        </h4>
        <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Quý khách nên đến trước giờ hẹn <strong>5 – 10 phút</strong> để nhân viên lễ tân hỗ trợ kiểm tra thông tin và chuẩn bị hồ sơ y tế tốt nhất.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Nếu cần dời lịch hoặc có việc đột xuất, quý khách có thể liên hệ số hotline <strong>{phone || 'của phòng khám'}</strong> để được hỗ trợ chuyển sang khung giờ khác hoàn toàn miễn phí.</span>
          </li>
        </ul>
      </div>

      {/* Action Navigation */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={handleNewBooking}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm shadow-md transition-colors text-center cursor-pointer"
        >
          Đặt thêm lịch hẹn mới
        </button>
      </div>
    </div>
  );
}
