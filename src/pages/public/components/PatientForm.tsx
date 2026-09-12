import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import { 
  ArrowLeft, 
  Clock, 
  Mail, 
  User, 
  Phone, 
  ShieldCheck, 
  MessageSquarePlus,
  ArrowRight,
  Send,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';

const DEFAULT_QUICK_TAGS = [
  'Đang đau nhức / Ê buốt',
  'Sợ đau / Nhạy cảm',
  'Muốn được tư vấn kỹ',
  'Khám răng định kỳ',
  'Cần xuất hóa đơn'
];

export default function PatientForm() {
  const { 
    sessionToken, 
    slotStartTime, 
    serviceName, 
    holdExpiresAt, 
    setStep, 
    bookingFormConfig,
    patientDraft,
    setPatientDraft
  } = useBookingStore();

  const navigate = useNavigate();
  const { slug } = useParams();
  const basePath = slug ? `/booking/${slug}` : '/book';

  const showNotificationChannels = bookingFormConfig?.showNotificationChannels !== false;
  const showHoldCountdown = bookingFormConfig?.showHoldCountdown !== false;

  const quickTags = bookingFormConfig?.quickNotesTags && Array.isArray(bookingFormConfig.quickNotesTags) && bookingFormConfig.quickNotesTags.length > 0
    ? bookingFormConfig.quickNotesTags
    : DEFAULT_QUICK_TAGS;

  const [bookingFor, setBookingFor] = useState<'self' | 'relative'>(patientDraft?.bookingFor || 'self');
  const [formData, setFormData] = useState({
    fullName: patientDraft?.fullName || '',
    phone: patientDraft?.phone || '',
    email: patientDraft?.email || '',
    telegramId: patientDraft?.telegramId || '',
    notes: patientDraft?.notes || ''
  });
  
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showAdvancedNotify, setShowAdvancedNotify] = useState(Boolean(patientDraft?.telegramId));

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setPatientDraft({ [field]: value });
  };

  const handleBookingForChange = (mode: 'self' | 'relative') => {
    setBookingFor(mode);
    setPatientDraft({ bookingFor: mode });
  };

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
    const current = formData.notes;
    let updated = '';
    
    if (current.includes(tag)) {
      updated = current.replace(tag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
    } else {
      updated = current ? `${current}, ${tag}` : tag;
    }
    
    setFormData(prev => ({ ...prev, notes: updated }));
    setPatientDraft({ notes: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setFieldErrors(prev => ({ ...prev, fullName: 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự)' }));
      return;
    }
    if (!validatePhone(formData.phone)) {
      setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ (VD: 0912345678)' }));
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      return;
    }

    setPatientDraft({
      bookingFor,
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      telegramId: formData.telegramId.trim(),
      notes: formData.notes.trim()
    });

    setStep(4);
    navigate(`${basePath}/xac-nhan`);
  };

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-3.5">
            <button 
              type="button"
              onClick={() => { setStep(2); navigate(`${basePath}/chon-gio`); }} 
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
              title="Quay lại chọn giờ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60 mb-1.5">
                Bước 3 / 5
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Hồ sơ bệnh nhân
              </h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                Thông tin giúp bác sĩ chuẩn bị đón tiếp chu đáo và bảo mật bệnh án của bạn.
              </p>
            </div>
          </div>
        </div>

        {/* Error / Hold Timer Alerts */}
        {error ? (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-[13px] font-medium flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-red-600" />
            </div>
            {error}
          </div>
        ) : (
          showHoldCountdown && holdExpiresAt && timeLeft > 0 && (
            <div className={`mb-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${isWarning ? 'bg-orange-50 border-orange-100' : 'bg-teal-50 border-teal-100/60'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isWarning ? 'bg-orange-100' : 'bg-teal-100'}`}>
                  <Clock className={`w-4 h-4 ${isWarning ? 'text-orange-600' : 'text-teal-700'}`} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[13px] font-bold ${isWarning ? 'text-orange-900' : 'text-teal-900'}`}>
                    Đang giữ lịch tạm thời
                  </span>
                  <span className={`text-[11px] font-medium ${isWarning ? 'text-orange-700' : 'text-teal-700/80'}`}>
                    Hoàn tất trong thời gian quy định
                  </span>
                </div>
              </div>
              <div className={`text-lg font-bold tracking-tight pr-1 ${isWarning ? 'text-orange-600 animate-pulse' : 'text-teal-700'}`}>
                {minutes}:{seconds < 10 ? '0' : ''}{seconds}
              </div>
            </div>
          )
        )}

        {/* Main Form */}
        <form id="patient-booking-form" onSubmit={handleSubmit} className="space-y-6">
          
          {/* Segmented Control */}
          <div className="bg-slate-100 p-1 rounded-xl flex relative max-w-[280px]">
            <div 
              className="absolute top-1 bottom-1 bg-white rounded-[10px] shadow-sm transition-all duration-300 ease-out border border-slate-200/50"
              style={{
                width: 'calc(50% - 4px)',
                left: bookingFor === 'self' ? '4px' : 'calc(50% + 0px)'
              }}
            />
            <button
              type="button"
              onClick={() => handleBookingForChange('self')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-bold transition-colors z-10 cursor-pointer ${
                bookingFor === 'self' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              Cho chính tôi
            </button>
            <button
              type="button"
              onClick={() => handleBookingForChange('relative')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-bold transition-colors z-10 cursor-pointer ${
                bookingFor === 'relative' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Cho người thân
            </button>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold tracking-widest uppercase text-slate-800 border-b border-slate-100 pb-2">
              Thông tin liên hệ
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Họ và tên người khám <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn An"
                    value={formData.fullName}
                    onChange={e => {
                      updateField('fullName', e.target.value);
                      if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: '' }));
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                      fieldErrors.fullName 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-slate-200 focus:border-teal-600 focus:ring-teal-600/10'
                    }`}
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="text-[11px] text-red-500 font-medium px-1">{fieldErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="VD: 0912 345 678"
                    value={formData.phone}
                    onChange={e => {
                      const val = e.target.value.replace(/[^\d\s.-]/g, '');
                      updateField('phone', val);
                      if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    onBlur={() => handleBlur('phone')}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                      fieldErrors.phone 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
                        : 'border-slate-200 focus:border-teal-600 focus:ring-teal-600/10'
                    }`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-[11px] text-red-500 font-medium px-1">{fieldErrors.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Channels */}
          {showNotificationChannels && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold tracking-widest uppercase text-slate-800">
                  Nhận vé khám & Nhắc hẹn
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wide">
                  Tự động
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Email nhận E-Ticket
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="VD: nhakhoa.khachhang@gmail.com"
                      value={formData.email}
                      onChange={e => {
                        updateField('email', e.target.value);
                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                      }}
                      onBlur={() => handleBlur('email')}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                        fieldErrors.email 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
                          : 'border-slate-200 focus:border-teal-600 focus:ring-teal-600/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p className="text-[11px] text-red-500 font-medium px-1">{fieldErrors.email}</p>
                  ) : (
                    <p className="text-[11px] text-slate-500 px-1 leading-relaxed">
                      Vé khám điện tử kèm mã QR check-in ưu tiên sẽ được gửi đến email này.
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedNotify(!showAdvancedNotify)}
                    className="group flex items-center gap-2 text-[13px] font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer outline-none"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      showAdvancedNotify ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}>
                      <Send className="w-3 h-3" />
                    </div>
                    <span>{showAdvancedNotify ? "Ẩn tùy chọn Telegram" : "Nhận thông báo qua Telegram (Miễn phí)"}</span>
                  </button>
                  
                  {showAdvancedNotify && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Telegram Username hoặc Chat ID
                      </label>
                      <input
                        type="text"
                        placeholder="VD: @username hoặc Chat ID"
                        value={formData.telegramId}
                        onChange={e => updateField('telegramId', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Bạn cũng có thể kết nối với Bot bằng 1 chạm sau khi hoàn tất đặt lịch.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Health Notes Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold tracking-widest uppercase text-slate-800 border-b border-slate-100 pb-2">
              Tình trạng & Lời nhắn
            </h3>
            
            <div className="space-y-3">
              {quickTags.length > 0 && (
                <div className="space-y-2.5">
                  <label className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wide">
                    Chọn nhanh:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {quickTags.map(tag => {
                      const isActive = formData.notes.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {isActive ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <textarea
                rows={3}
                placeholder="Bạn có điều gì muốn bác sĩ lưu ý trước không? (Ví dụ: đang ê buốt răng hàm dưới, tiền sử dị ứng thuốc tê...)"
                value={formData.notes}
                onChange={e => updateField('notes', e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="rounded-xl bg-teal-50/50 border border-teal-100 p-3.5 flex items-start gap-3 mt-2">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-teal-900 text-[12px] uppercase tracking-wide">
                Bảo mật thông tin y tế
              </p>
              <p className="text-[11px] text-teal-800/80 leading-relaxed">
                Dữ liệu cá nhân chỉ được sử dụng cho mục đích chuyên môn, tuyệt đối không chia sẻ cho bên thứ ba.
              </p>
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden sm:block pt-4">
            <button
              type="submit"
              disabled={!!error || (holdExpiresAt && timeLeft === 0)}
              className="w-full py-3.5 px-6 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Tiếp tục kiểm tra
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Sticky Mobile Footer */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white border-t border-slate-200 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Lịch hẹn</span>
          <span className="text-[13px] font-extrabold text-slate-900">
            {slotStartTime ? format(new Date(slotStartTime), 'HH:mm - dd/MM') : 'Đang chọn'}
          </span>
          <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${isWarning ? 'text-orange-600 animate-pulse' : 'text-teal-700'}`}>
            <Clock className="w-3.5 h-3.5" /> Giữ chỗ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>
        <button
          type="submit"
          form="patient-booking-form"
          disabled={!!error || (holdExpiresAt && timeLeft === 0)}
          className="flex-1 max-w-[140px] py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-[13px] rounded-xl shadow-md shadow-teal-900/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          Tiếp tục
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
