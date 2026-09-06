import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { 
  ArrowLeft, 
  Clock, 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Mail, 
  User, 
  Phone, 
  Lock, 
  ShieldCheck, 
  Sparkles,
  HeartHandshake,
  MessageSquarePlus,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const QUICK_TAGS = [
  'Đang đau nhức / Ê buốt',
  'Sợ đau / Nhạy cảm',
  'Muốn được tư vấn kỹ',
  'Khám răng định kỳ',
  'Cần xuất hóa đơn'
];

export default function PatientForm() {
  const { sessionToken, slotStartTime, serviceName, holdExpiresAt, setStep } = useBookingStore();
  const navigate = useNavigate();

  const [bookingFor, setBookingFor] = useState<'self' | 'relative'>('self');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    telegramId: '',
    notes: ''
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showAdvancedNotify, setShowAdvancedNotify] = useState(false);

  // Hold Timer logic
  useEffect(() => {
    if (!holdExpiresAt) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setError('Thời gian giữ chỗ đã hết hạn. Vui lòng quay lại chọn lại khung giờ.');
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isWarning = timeLeft < 120 && timeLeft > 0;

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/[\s.-]/g, '');
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    return phoneRegex.test(cleaned);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleBlur = (field: 'phone' | 'email') => {
    if (field === 'phone' && formData.phone) {
      if (!validatePhone(formData.phone)) {
        setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại gồm 10 chữ số (VD: 0912345678)' }));
      } else {
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next.phone;
          return next;
        });
      }
    }
    if (field === 'email' && formData.email) {
      if (!validateEmail(formData.email)) {
        setFieldErrors(prev => ({ ...prev, email: 'Định dạng email chưa chính xác (VD: ten@gmail.com)' }));
      } else {
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next.email;
          return next;
        });
      }
    }
  };

  const handleToggleTag = (tag: string) => {
    setFormData(prev => {
      const current = prev.notes;
      if (current.includes(tag)) {
        // Remove
        const updated = current.replace(tag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
        return { ...prev, notes: updated };
      } else {
        // Add
        const updated = current ? `${current}, ${tag}` : tag;
        return { ...prev, notes: updated };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ (VD: 0912345678)' }));
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      return;
    }

    setSubmitting(true);
    setError('');

    const patientNote = bookingFor === 'relative' 
      ? `[Đặt cho người thân] ${formData.notes.trim()}` 
      : formData.notes.trim();

    try {
      const res = await api.post('/public/appointments', {
        sessionToken,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        telegramId: formData.telegramId.trim() || undefined,
        notes: patientNote || undefined
      });

      if (res.data.success) {
        const appointmentData = res.data.data;
        if (appointmentData && appointmentData.appointmentId) {
          const myAppts = JSON.parse(localStorage.getItem('myAppointments') || '[]');
          myAppts.push({
            id: appointmentData.appointmentId,
            startAt: slotStartTime,
            email: formData.email.trim() || undefined
          });
          localStorage.setItem('myAppointments', JSON.stringify(myAppts));
          
          useBookingStore.getState().setAppointmentSuccess(
            appointmentData.appointmentId, 
            formData.fullName, 
            formData.phone,
            formData.email.trim() || null,
            formData.telegramId.trim() || null,
            appointmentData.telegramBotUsername || null
          );
          navigate('/book/hoan-tat');
        } else {
          setStep(4);
          navigate('/book/hoan-tat');
        }
      }
    } catch (err: any) {
      if (err.response?.data?.error?.details) {
        const details = err.response.data.error.details;
        if (Array.isArray(details)) {
          setError(details.map((d: any) => d.message).join(', '));
        } else {
          setError(err.response.data.error.message);
        }
      } else {
        setError(err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button 
              type="button"
              onClick={() => { setStep(2); navigate('/book/chon-gio'); }} 
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 transition-colors mt-0.5"
              title="Quay lại chọn giờ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200/60 mb-2">
                <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />
                Bước 3 / 3
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Hồ Sơ Tiếp Đón Chu Đáo
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                Thông tin của bạn giúp bác sĩ và đội ngũ lễ tân chuẩn bị đón tiếp nồng hậu và bảo mật thông tin bệnh án.
              </p>
            </div>
          </div>

          {/* Real-time Hold Badge */}
          {slotStartTime && (
            <div className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 border text-xs font-bold shrink-0 self-start sm:self-center ${
              isWarning 
                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
                : 'bg-teal-50 text-teal-800 border-teal-200/80'
            }`}>
              <Lock className="w-4 h-4" />
              <span>Giữ chỗ riêng:</span>
              <span className="font-mono text-sm">{minutes}:{seconds < 10 ? '0' : ''}{seconds}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Intake Form */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-md shadow-slate-200/30 pb-24 sm:pb-8">
        <form id="patient-booking-form" onSubmit={handleSubmit} className="space-y-7">
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 animate-in fade-in duration-300">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-red-700 font-semibold">{error}</div>
            </div>
          )}

          {/* Choice: Self or Relative */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-600" />
              Lịch khám này dành cho ai?
            </label>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <button
                type="button"
                onClick={() => setBookingFor('self')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all text-center flex items-center justify-center gap-2 ${
                  bookingFor === 'self'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Cho chính tôi</span>
              </button>
              <button
                type="button"
                onClick={() => setBookingFor('relative')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all text-center flex items-center justify-center gap-2 ${
                  bookingFor === 'relative'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Cho người thân</span>
              </button>
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-teal-600" />
              Thông tin liên hệ người khám
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center justify-between">
                  <span>Họ và tên người khám <span className="text-red-500">*</span></span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="text"
                    placeholder="VD: Nguyễn Văn An"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-700">
                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                  </label>
                  {fieldErrors.phone && (
                    <span className="text-xs font-semibold text-red-500">{fieldErrors.phone}</span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="tel"
                    placeholder="0912 345 678"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={() => handleBlur('phone')}
                    className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Automated Notification Channels */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Kênh nhận vé khám & nhắc hẹn thông minh
              </h3>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                Tự động gửi
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Email nhận vé khám điện tử & lịch hẹn</span>
                </label>
                {fieldErrors.email && (
                  <span className="text-xs font-semibold text-red-500">{fieldErrors.email}</span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="nhakhoa.khachhang@gmail.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  onBlur={() => handleBlur('email')}
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all outline-none"
                />
              </div>
              <p className="text-xs text-slate-500 pl-1 leading-relaxed">
                Vé khám điện tử (E-Ticket) có mã QR check-in ưu tiên sẽ được gửi đến email này để bạn dễ dàng lưu vào điện thoại.
              </p>
            </div>

            {/* Optional Telegram Notification */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedNotify(!showAdvancedNotify)}
                className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-teal-700 transition-colors flex items-center gap-2 focus:outline-none"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                  showAdvancedNotify ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Send className="w-3 h-3" />
                </div>
                <span>{showAdvancedNotify ? "Thu gọn tùy chọn Telegram" : "Nhận tin nhắn nhắc lịch qua Telegram (Miễn phí & Tức thì)"}</span>
              </button>

              {showAdvancedNotify && (
                <div className="mt-3 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    Telegram Username hoặc Chat ID
                  </label>
                  <input
                    type="text"
                    placeholder="VD: @username hoặc Chat ID"
                    value={formData.telegramId}
                    onChange={e => setFormData({ ...formData, telegramId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
                  />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    💡 Sau khi hoàn tất đặt lịch, bạn cũng có thể nhấn 1 chạm để kết nối trực tiếp với Bot mà không cần nhập thủ công.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Health Note & Wishes */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MessageSquarePlus className="w-4 h-4 text-teal-600" />
              Tình trạng răng miệng & Lời nhắn gửi bác sĩ
            </h3>

            {/* Quick Choice Chips */}
            <div className="space-y-2">
              <label className="text-xs text-slate-500">
                Chọn nhanh tình trạng hoặc mong muốn (có thể chọn nhiều):
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map(tag => {
                  const isActive = formData.notes.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        isActive
                          ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {isActive ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                rows={3}
                placeholder="Bạn có điều gì muốn bác sĩ lưu ý trước không? (Ví dụ: đang ê buốt răng hàm dưới, tiền sử dị ứng thuốc tê, cần khám nhanh...)"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all outline-none resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Privacy & Safe Commitment Banner */}
          <div className="rounded-2xl bg-teal-50/60 border border-teal-200/60 p-4 sm:p-5 flex items-start gap-3.5">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
              <p className="font-bold text-slate-800">
                Cam kết bảo mật thông tin y tế tuyệt đối
              </p>
              <p>
                Dữ liệu cá nhân của bạn chỉ được sử dụng cho mục đích phục vụ chuyên môn khám chữa bệnh tại phòng khám. Tuyệt đối không chia sẻ cho bên thứ ba hoặc gửi cuộc gọi quảng cáo phiền toái.
              </p>
            </div>
          </div>

          {/* Confirmation CTA Button */}
          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-teal-900/20 hover:shadow-xl hover:shadow-teal-900/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xử lý đặt lịch hẹn...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Xác Nhận Đặt Lịch Khám</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-xs text-center text-slate-400">
              Bằng việc xác nhận, bạn đồng ý với tiêu chuẩn phục vụ và quy chế đón tiếp của phòng khám.
            </p>
          </div>
        </form>
      </div>

      {/* Sticky Mobile Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lịch hẹn</span>
          <span className="text-xs font-bold text-slate-900">
            {slotStartTime ? format(new Date(slotStartTime), 'HH:mm - dd/MM') : 'Đang chọn'}
          </span>
          <span className={`text-[10px] font-semibold flex items-center gap-1 ${isWarning ? 'text-red-600 animate-pulse' : 'text-teal-700'}`}>
            <Clock className="w-3 h-3" /> Giữ chỗ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>

        <button
          type="submit"
          form="patient-booking-form"
          disabled={submitting}
          className="py-3 px-5 bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Xác nhận</span>
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
