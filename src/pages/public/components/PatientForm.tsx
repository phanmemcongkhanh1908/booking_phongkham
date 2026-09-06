import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { toast } from 'react-hot-toast';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ArrowLeft, Clock, AlertTriangle, Send, Mail, CheckCircle2, Bell, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function PatientForm() {
  const navigate = useNavigate();
  const { sessionToken, slotStartTime, setStep, holdExpiresAt } = useBookingStore();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    telegramId: '',
    notes: ''
  });

  const calculateTimeLeft = () => {
    if (!holdExpiresAt) return 0;
    const now = Date.now();
    return Math.max(0, Math.floor((holdExpiresAt - now) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedNotify, setShowAdvancedNotify] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        toast.error("Đã hết thời gian giữ chỗ. Vui lòng chọn lại ngày giờ.");
        setStep(2);
        navigate('/book/chon-gio');
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) updateTimer();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [holdExpiresAt, setStep]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isWarning = timeLeft <= 60;

  
  const [fieldErrors, setFieldErrors] = useState({ phone: '', email: '' });

  const validatePhone = (phone) => {
    if (!phone) return true;
    const cleanPhone = phone.replace(/[\s-]/g, '');
    const phoneRegex = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
    return phoneRegex.test(cleanPhone);
  };

  const validateEmail = (email) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleBlur = (field) => {
    if (field === 'phone' && formData.phone) {
      if (!validatePhone(formData.phone)) {
        setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ' }));
      } else {
        setFieldErrors(prev => ({ ...prev, phone: '' }));
      }
    }
    if (field === 'email' && formData.email) {
      if (!validateEmail(formData.email)) {
        setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      } else {
        setFieldErrors(prev => ({ ...prev, email: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ' }));
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      return;
    }

    setSubmitting(true);
    setError('');


    try {
      const res = await api.post('/public/appointments', {
        sessionToken,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        telegramId: formData.telegramId.trim() || undefined,
        notes: formData.notes.trim() || undefined
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
    <Card className="border-0 shadow-none sm:border sm:border-slate-200 sm:shadow-lg sm:shadow-slate-200/40 rounded-2xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center gap-4 text-center sm:text-left bg-gradient-to-b from-slate-50 to-white pb-6 border-b border-slate-100 p-4 md:p-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => { setStep(2); navigate('/book/chon-gio'); }} 
          className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors h-10 w-10"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <CardTitle className="text-xl md:text-2xl text-slate-800 font-bold">Thông tin liên hệ</CardTitle>
          {slotStartTime && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md inline-flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(new Date(slotStartTime), 'HH:mm - dd/MM/yyyy')}
              </span>
              <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-md transition-colors ${isWarning ? 'bg-red-50 text-red-600 animate-pulse border border-red-100' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
                {isWarning ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                Giữ chỗ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6 pb-20 sm:pb-6">
        <form id="patient-booking-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
          
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Họ và tên <span className="text-red-500">*</span></label>
              <Input 
                required 
                placeholder="VD: Nguyễn Văn A" 
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                className="h-11 md:h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center"><label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-error">*</span></label>{fieldErrors.phone && <span className="text-xs text-error">{fieldErrors.phone}</span>}</div>
              <Input 
                required 
                type="tel" 
                placeholder="0912.345.678" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                onBlur={() => handleBlur('phone')}
                className="h-11 md:h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><label className="text-sm font-semibold text-slate-700">Email nhận thông báo</label>{fieldErrors.email && <span className="text-xs text-error ml-2">{fieldErrors.email}</span>}</div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">Khuyên dùng</span>
            </div>
            <Input 
              type="email" 
              placeholder="nhakhoa.khachhang@gmail.com" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              onBlur={() => handleBlur('email')}
              className="h-11 md:h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
            />
            <p className="text-xs text-slate-500 pl-1">
              Hệ thống sẽ gửi vé khám điện tử và nhắc lịch hẹn tự động qua email này.
            </p>
          </div>

          {/* Optional Telegram Integration Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdvancedNotify(!showAdvancedNotify)}
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors flex items-center gap-2 focus:outline-none"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${showAdvancedNotify ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                <Send className="w-3 h-3" />
              </div>
              {showAdvancedNotify ? "Ẩn tùy chọn Telegram" : "Nhận thông báo qua Telegram (Tùy chọn)"}
            </button>
            
            {showAdvancedNotify && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  Telegram Username hoặc Chat ID
                </label>
                <Input 
                  type="text" 
                  placeholder="VD: @username hoặc Chat ID" 
                  value={formData.telegramId}
                  onChange={e => setFormData({...formData, telegramId: e.target.value})}
                  className="bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg h-11"
                />
                <p className="text-xs text-blue-600/80 leading-relaxed">
                  💡 Bạn cũng có thể liên kết nhanh với Telegram Bot bằng 1 cú nhấp chuột tại trang hoàn tất đặt lịch.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-semibold text-slate-700">Triệu chứng / Yêu cầu đặc biệt</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-colors resize-y"
              placeholder="Bạn có đang đau nhức răng hoặc có yêu cầu đặc biệt nào không?"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="p-3 bg-teal-50/50 border border-teal-100/50 rounded-xl flex items-start gap-3 text-xs text-slate-600">
            <Bell className="w-5 h-5 text-teal-600 shrink-0" />
            <span className="pt-0.5 leading-relaxed">
              Thông báo xác nhận lịch hẹn sẽ được gửi tự động ngay sau khi phòng khám tiếp nhận và xác nhận lịch của bạn.
            </span>
          </div>

          <div className="pt-6">
            <Button 
              type="submit" 
              className="w-full h-12 md:h-14 text-base bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98]" 
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Xác nhận đặt lịch <CheckCircle2 className="w-5 h-5" />
                </span>
              )}
            </Button>
            <p className="mt-4 flex items-start justify-center gap-2 text-xs text-slate-500 text-center max-w-sm mx-auto">
              <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
              Bằng việc xác nhận, bạn đồng ý với chính sách chăm sóc và bảo mật của phòng khám.
            </p>
          </div>
        </form>
      </CardContent>

      {/* Sticky Action Bar on Mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Thời gian khám</span>
          <span className="text-xs font-bold text-slate-800">
            {slotStartTime ? format(new Date(slotStartTime), 'HH:mm - dd/MM') : 'Đang chọn'}
          </span>
          <span className={`text-[10px] font-semibold flex items-center gap-1 ${isWarning ? 'text-red-600 animate-pulse' : 'text-teal-700'}`}>
            <Clock className="w-3 h-3" /> Giữ chỗ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>

        <Button
          type="submit"
          form="patient-booking-form"
          disabled={submitting}
          className="h-11 px-5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-1.5"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Xác nhận</span>
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
