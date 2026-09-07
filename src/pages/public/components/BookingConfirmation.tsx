import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  Edit3, 
  Lock,
  Sparkles,
  Send,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function BookingConfirmation() {
  const { 
    sessionToken, 
    slotStartTime, 
    serviceId,
    serviceName, 
    servicePrice,
    serviceDuration,
    holdExpiresAt, 
    patientDraft, 
    setStep, 
    bookingFormConfig 
  } = useBookingStore();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Guard: if essential data is missing, redirect to beginning
  useEffect(() => {
    if (!sessionToken || !slotStartTime || !patientDraft?.fullName || !patientDraft?.phone) {
      if (!serviceId) {
        navigate('/book/dich-vu');
      } else if (!sessionToken || !slotStartTime) {
        navigate('/book/chon-gio');
      } else {
        navigate('/book/thong-tin');
      }
    }
  }, [sessionToken, slotStartTime, patientDraft, serviceId, navigate]);

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
  const isExpired = timeLeft === 0 && holdExpiresAt !== null;

  const handleConfirmAppointment = async () => {
    if (isExpired) {
      setError('Thời gian giữ chỗ đã hết. Vui lòng quay lại chọn lại giờ khám để tiếp tục.');
      return;
    }
    if (!patientDraft) return;

    setSubmitting(true);
    setError(null);

    const patientNote = patientDraft.bookingFor === 'relative'
      ? `[Đặt cho người thân] ${patientDraft.notes || ''}`.trim()
      : (patientDraft.notes || '').trim();

    try {
      const res = await api.post('/public/appointments', {
        sessionToken,
        fullName: patientDraft.fullName.trim(),
        phone: patientDraft.phone.trim(),
        email: patientDraft.email ? patientDraft.email.trim() : undefined,
        telegramId: patientDraft.telegramId ? patientDraft.telegramId.trim() : undefined,
        notes: patientNote || undefined
      });

      if (res.data.success) {
        const appointmentData = res.data.data;
        if (appointmentData && appointmentData.appointmentId) {
          // Lưu vào lịch sử cục bộ
          const myAppts = JSON.parse(localStorage.getItem('myAppointments') || '[]');
          myAppts.push({
            id: appointmentData.appointmentId,
            startAt: slotStartTime,
            email: patientDraft.email ? patientDraft.email.trim() : undefined
          });
          localStorage.setItem('myAppointments', JSON.stringify(myAppts));

          useBookingStore.getState().setAppointmentSuccess(
            appointmentData.appointmentId,
            patientDraft.fullName,
            patientDraft.phone,
            patientDraft.email || null,
            patientDraft.telegramId || null,
            appointmentData.telegramBotUsername || null
          );
          navigate('/book/hoan-tat');
        } else {
          setStep(5);
          navigate('/book/hoan-tat');
        }
      } else {
        // Lỗi trả về từ backend nhưng không ném exception
        setError(res.data.message || 'Không thể hoàn tất lịch hẹn. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error("Booking error:", err);
      if (err.response?.data?.error?.details) {
        const details = err.response.data.error.details;
        if (Array.isArray(details)) {
          setError(details.map((d: any) => d.message).join(', '));
        } else {
          setError(String(err.response.data.error.details));
        }
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Hệ thống gặp sự cố kết nối khi tạo lịch hẹn. Vui lòng kiểm tra lại đường truyền mạng hoặc thử lại sau.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const parsedDate = slotStartTime ? new Date(slotStartTime) : null;

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => {
                setStep(3);
                navigate('/book/thong-tin');
              }}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 transition-colors mt-0.5 cursor-pointer"
              title="Quay lại chỉnh sửa thông tin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                Bước 4 / 5
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Kiểm Tra & Hoàn Tất Lịch Khám
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                Vui lòng đối chiếu thông tin lịch hẹn dưới đây trước khi phòng khám gửi xác nhận tiếp đón chính thức.
              </p>
            </div>
          </div>

          {/* Real-time Hold Countdown */}
          {slotStartTime && holdExpiresAt && (
            <div className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 border text-xs font-bold shrink-0 self-start sm:self-center ${
              isWarning 
                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
                : 'bg-teal-50 text-teal-800 border-teal-200/80'
            }`}>
              <Lock className="w-4 h-4" />
              <span>Khung giờ đang giữ:</span>
              <span className="font-mono text-sm">{minutes}:{seconds < 10 ? '0' : ''}{seconds}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert if Any */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3.5 animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-800">Không thể hoàn tất lịch khám</h4>
            <p className="text-xs sm:text-sm text-red-700 leading-relaxed">{error}</p>
            {isExpired && (
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  navigate('/book/chon-gio');
                }}
                className="mt-2 text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer"
              >
                Nhấn vào đây để chọn lại khung giờ mới
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review Details Container */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Review Cards */}
        <div className="md:col-span-2 space-y-5">
          {/* Card 1: Service Selected */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-700" />
                Dịch vụ nha khoa đã chọn
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  navigate('/book/dich-vu');
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Đổi dịch vụ
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{serviceName || 'Dịch vụ khám tiêu chuẩn'}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {serviceDuration ? `${serviceDuration} phút` : '30 - 45 phút'}
                  </span>
                  <span>•</span>
                  <span>Bác sĩ chuyên khoa phụ trách</span>
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-xs text-slate-400 block font-medium">Chi phí dự kiến</span>
                <span className="text-lg font-extrabold text-teal-700">
                  {servicePrice ? `${servicePrice.toLocaleString('vi-VN')} đ` : 'Miễn phí khám'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Schedule & Time */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-teal-700" />
                Thời gian tiếp đón
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  navigate('/book/chon-gio');
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Đổi ngày giờ
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] uppercase font-bold text-teal-700">
                    {parsedDate ? format(parsedDate, 'MMM', { locale: vi }) : ''}
                  </span>
                  <span className="text-base font-extrabold leading-none">
                    {parsedDate ? format(parsedDate, 'dd') : '--'}
                  </span>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {parsedDate ? format(parsedDate, 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi }) : 'Chưa chọn'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phòng khám Nha Khoa Tiêu Chuẩn Quốc Tế</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Patient Information */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-4 h-4 text-teal-700" />
                Thông tin người khám
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                  navigate('/book/thong-tin');
                }}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Chỉnh sửa
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Họ và tên</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {patientDraft?.fullName || 'Chưa cung cấp'}
                  {patientDraft?.bookingFor === 'relative' && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                      Người thân
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Số điện thoại liên hệ</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {patientDraft?.phone || 'Chưa cung cấp'}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Email nhận vé khám</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {patientDraft?.email || 'Không đăng ký (nhận SMS)'}
                </span>
              </div>

              {patientDraft?.telegramId && (
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Tài khoản Telegram</span>
                  <span className="font-semibold text-blue-700 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    {patientDraft.telegramId}
                  </span>
                </div>
              )}

              {patientDraft?.notes && (
                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400 block mb-1">Ghi chú tình trạng & Lời nhắn</span>
                  <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                    {patientDraft.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Confirmation */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-md shadow-slate-200/30 space-y-5">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Xác Nhận Đặt Lịch
            </h3>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>Không yêu cầu thanh toán trước, chỉ thu phí tại phòng khám sau khi hoàn thành dịch vụ.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>Lịch hẹn sẽ được gửi xác nhận qua SMS/Email ngay lập tức.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>Được hỗ trợ dời hoặc hủy lịch khám linh hoạt trước giờ hẹn.</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmAppointment}
                disabled={submitting || isExpired}
                className="w-full py-4 px-6 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-teal-900/20 hover:shadow-xl hover:shadow-teal-900/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang hoàn tất đặt lịch...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Xác Nhận Đặt Lịch Ngay</span>
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400 leading-normal">
              Bằng việc bấm xác nhận, bạn đồng ý với tiêu chuẩn phục vụ của phòng khám và cam kết đến đúng giờ hẹn.
            </p>
          </div>

          {/* Privacy Note */}
          <div className="rounded-2xl bg-teal-50/60 border border-teal-200/60 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Thông tin liên hệ của bạn được mã hóa an toàn và chỉ phục vụ việc tiếp đón tại phòng khám.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Xác nhận</span>
          <span className="text-xs font-bold text-slate-900">
            {parsedDate ? format(parsedDate, 'HH:mm - dd/MM') : 'Lịch khám'}
          </span>
          <span className={`text-[10px] font-semibold flex items-center gap-1 ${isWarning ? 'text-red-600 animate-pulse' : 'text-teal-700'}`}>
            <Clock className="w-3 h-3" /> {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>

        <button
          type="button"
          onClick={handleConfirmAppointment}
          disabled={submitting || isExpired}
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
