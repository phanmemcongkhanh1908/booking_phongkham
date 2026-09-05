import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ArrowLeft, Clock, AlertTriangle, Mail, Send, Bell } from 'lucide-react';
import { format } from 'date-fns';

export default function PatientForm() {
  const { sessionToken, slotStartTime, setStep } = useBookingStore();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    telegramId: '',
    notes: ''
  });
  const [showAdvancedNotify, setShowAdvancedNotify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // 5 Minute Timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (timeLeft <= 0) {
      alert("Thời gian giữ chỗ đã hết, vui lòng chọn lại khung giờ.");
      setStep(2);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, setStep]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isWarning = timeLeft <= 60;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        } else {
          setStep(4);
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
    <Card className="border-0 shadow-none sm:border sm:shadow-soft">
      <CardHeader className="flex flex-row items-center gap-4 text-center sm:text-left space-y-0">
        <Button variant="ghost" size="icon" onClick={() => setStep(2)} className="shrink-0 rounded-full bg-slate-100">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <CardTitle className="text-xl">Thông tin của bạn</CardTitle>
          {slotStartTime && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-muted hidden sm:inline">{format(new Date(slotStartTime), 'HH:mm dd/MM/yyyy')}</span>
              <div className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${isWarning ? 'bg-status-cancelled-bg text-status-cancelled animate-pulse' : 'bg-mint text-primary'}`}>
                {isWarning ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                Giữ chỗ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-status-cancelled-bg p-3 text-sm text-status-cancelled">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-main">Họ và tên <span className="text-red-500">*</span></label>
            <Input 
              required 
              placeholder="Ví dụ: Nguyễn Văn A" 
              value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-main">Số điện thoại <span className="text-red-500">*</span></label>
            <Input 
              required 
              type="tel" 
              placeholder="0912345678" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>

          {/* Email Notification Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-main flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-primary" />
                Email nhận xác nhận & nhắc hẹn
              </label>
              <span className="text-xs text-text-muted font-normal">Khuyên dùng</span>
            </div>
            <Input 
              type="email" 
              placeholder="nhakhoa.khachhang@gmail.com" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
            <p className="text-xs text-text-muted">
              Hệ thống sẽ tự động gửi vé khám điện tử và nhắc lịch hẹn trước giờ khám qua email này.
            </p>
          </div>

          {/* Optional Telegram Integration Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedNotify(!showAdvancedNotify)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5 focus:outline-none"
            >
              <Send className="w-3.5 h-3.5" />
              {showAdvancedNotify ? "Ẩn tùy chọn Telegram" : "Tùy chọn: Nhận thông báo qua Telegram"}
            </button>

            {showAdvancedNotify && (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-medium text-text-main flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-500" />
                  Telegram Username hoặc Chat ID (Tùy chọn)
                </label>
                <Input 
                  type="text" 
                  placeholder="VD: @username hoặc Chat ID (nếu có)" 
                  value={formData.telegramId}
                  onChange={e => setFormData({...formData, telegramId: e.target.value})}
                  className="bg-white text-xs h-9"
                />
                <p className="text-[11px] text-text-muted leading-relaxed">
                  💡 Bạn cũng có thể liên kết nhanh với Telegram Bot bằng 1 cú nhấp chuột tại trang hoàn tất đặt lịch tiếp theo.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-main">Triệu chứng / Ghi chú (Không bắt buộc)</label>
            <textarea
              className="flex min-h-[70px] w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm ring-offset-white placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              placeholder="Bạn có đang đau nhức răng hoặc có yêu cầu đặc biệt nào không?"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="p-3 bg-mint/50 border border-primary/20 rounded-lg flex items-start gap-2.5 text-xs text-text-main">
            <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              Thông báo xác nhận lịch hẹn sẽ được gửi tự động ngay sau khi phòng khám tiếp nhận và xác nhận lịch của bạn.
            </span>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-medium" size="lg" disabled={submitting}>
              {submitting ? 'Đang gửi thông tin...' : 'Xác nhận đặt lịch'}
            </Button>
            <p className="mt-3 text-center text-xs text-text-muted">Bằng việc xác nhận, bạn đồng ý với chính sách chăm sóc và bảo mật của phòng khám.</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
