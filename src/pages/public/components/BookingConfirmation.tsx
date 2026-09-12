import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  User, 
  Phone, 
  Mail, 
  Edit3, 
  Lock,
  Sparkles,
  Send,
  Building,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';

export default function BookingConfirmation() {
  const { 
    sessionToken, 
    slotStartTime, 
    serviceId,
    serviceName, 
    servicePrice,
    serviceIsFree,
    serviceShowPrice,
    serviceDuration,
    holdExpiresAt, 
    patientDraft, 
    setStep, 
    bookingFormConfig 
  } = useBookingStore();

  const navigate = useNavigate();
  const { slug } = useParams();
  const basePath = slug ? `/booking/${slug}` : '/book';
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!sessionToken || !slotStartTime || !patientDraft?.fullName || !patientDraft?.phone) {
      if (!serviceId) {
        navigate(`${basePath}/dich-vu`);
      } else if (!sessionToken || !slotStartTime) {
        navigate(`${basePath}/chon-gio`);
      } else {
        navigate(`${basePath}/thong-tin`);
      }
    }
  }, [sessionToken, slotStartTime, patientDraft, serviceId, navigate]);

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
          navigate(`${basePath}/hoan-tat`);
        } else {
          setStep(5);
          navigate(`${basePath}/hoan-tat`);
        }
      } else {
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
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Hệ thống gặp sự cố kết nối khi tạo lịch hẹn. Vui lòng kiểm tra lại đường truyền mạng hoặc thử lại sau.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const parsedDate = slotStartTime ? new Date(slotStartTime) : null;

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {/* Step Header */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-3.5">
            <button
              type="button"
              onClick={() => {
                setStep(3);
                navigate(`${basePath}/thong-tin`);
              }}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
              title="Quay lại chỉnh sửa thông tin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60 mb-1.5">
                Bước 4 / 5
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Kiểm tra & Hoàn tất
              </h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                Vui lòng đối chiếu thông tin dưới đây trước khi gửi xác nhận chính thức.
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Hold Countdown */}
        {slotStartTime && holdExpiresAt && (
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${isWarning ? 'bg-orange-50 border-orange-100' : 'bg-teal-50 border-teal-100/60'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isWarning ? 'bg-orange-100' : 'bg-teal-100'}`}>
                <Clock className={`w-4 h-4 ${isWarning ? 'text-orange-600' : 'text-teal-700'}`} />
              </div>
              <div className="flex flex-col">
                <span className={`text-[13px] font-bold ${isWarning ? 'text-orange-900' : 'text-teal-900'}`}>
                  Khung giờ đang giữ
                </span>
              </div>
            </div>
            <div className={`text-lg font-bold tracking-tight pr-1 ${isWarning ? 'text-orange-600 animate-pulse' : 'text-teal-700'}`}>
              {minutes}:{seconds < 10 ? '0' : ''}{seconds}
            </div>
          </div>
        )}
      </div>

      {/* Error Alert if Any */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3.5 animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[13px] font-bold text-red-800">Không thể hoàn tất lịch khám</h4>
            <p className="text-[12px] sm:text-[13px] text-red-700 leading-relaxed">{error}</p>
            {isExpired && (
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  navigate(`${basePath}/chon-gio`);
                }}
                className="mt-2 text-[12px] font-bold text-red-700 underline hover:text-red-900 cursor-pointer"
              >
                Nhấn vào đây để chọn lại khung giờ mới
              </button>
            )}
          </div>
        </div>
      )}

      {/* Review Details Container */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Left Column: Review Cards */}
        <div className="md:col-span-2 space-y-4">
          
          {/* Card 1: Service Selected */}
          <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                Dịch vụ đã chọn
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  navigate(`${basePath}/dich-vu`);
                }}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-snug">
                  {serviceName || 'Dịch vụ khám tiêu chuẩn'}
                </h3>
                <div className="flex items-center gap-3 text-[12px] text-slate-500 mt-1.5 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {serviceDuration ? `${serviceDuration} phút` : '30 - 45 phút'}
                  </span>
                </div>
              </div>
              <div className="sm:text-right mt-1 sm:mt-0">
                {(serviceIsFree || (servicePrice && servicePrice > 0)) ? (
                  <>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Chi phí dự kiến</span>
                    <span className="text-base font-extrabold text-teal-700 tracking-tight">
                      {serviceIsFree ? 'Miễn phí' : `${servicePrice!.toLocaleString('vi-VN')} đ`}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Card 2: Schedule & Time */}
          <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-700" />
                Thời gian tiếp đón
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  navigate(`${basePath}/chon-gio`);
                }}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa
              </button>
            </div>
            
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 flex flex-col items-center justify-center shrink-0 shadow-sm">
                <span className="text-[9px] uppercase font-bold text-teal-700 mb-0.5">
                  {parsedDate ? format(parsedDate, 'MMM', { locale: vi }) : ''}
                </span>
                <span className="text-[15px] font-extrabold leading-none">
                  {parsedDate ? format(parsedDate, 'dd') : '--'}
                </span>
              </div>
              <div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">
                  {parsedDate ? format(parsedDate, 'HH:mm - EEEE, dd/MM', { locale: vi }) : 'Chưa chọn'}
                </div>
                <div className="text-[12px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phòng khám Tiêu Chuẩn Quốc Tế</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Patient Information */}
          <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                Thông tin người khám
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                  navigate(`${basePath}/thong-tin`);
                }}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sửa
              </button>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Họ và tên</span>
                <span className="font-bold text-[13px] text-slate-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {patientDraft?.fullName || 'Chưa cung cấp'}
                  {patientDraft?.bookingFor === 'relative' && (
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ml-1">
                      Người thân
                    </span>
                  )}
                </span>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Điện thoại</span>
                <span className="font-bold text-[13px] text-slate-900 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {patientDraft?.phone || 'Chưa cung cấp'}
                </span>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Email nhận vé</span>
                <span className="font-bold text-[13px] text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {patientDraft?.email || 'Không đăng ký (nhận SMS)'}
                  </span>
                </span>
              </div>

              {patientDraft?.telegramId && (
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400 block mb-1">Telegram</span>
                  <span className="font-bold text-[13px] text-blue-700 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate">{patientDraft.telegramId}</span>
                  </span>
                </div>
              )}
              
              {patientDraft?.notes && (
                <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1.5 flex items-center gap-1">
                    Ghi chú & Lời nhắn
                  </span>
                  <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {patientDraft.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Confirmation */}
        <div className="space-y-4">
          <div className="rounded-[20px] border border-teal-200/60 bg-teal-50/30 p-5 shadow-sm space-y-4">
            <h3 className="text-[14px] font-bold text-teal-900 border-b border-teal-100 pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              Cam kết dịch vụ
            </h3>
            
            <div className="space-y-3.5 text-[12px] font-medium text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <p>Mọi chi phí phát sinh sẽ được <strong>thông báo minh bạch</strong> trước khi tiến hành điều trị.</p>
              </div>
              
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3 h-3" />
                </div>
                <p>Khách hàng đặt lịch trước sẽ được <strong>ưu tiên tiếp đón ngay</strong> không cần chờ đợi.</p>
              </div>
            </div>

            {/* Desktop CTA */}
            <div className="hidden sm:block pt-4 border-t border-teal-100">
              <button
                type="button"
                onClick={handleConfirmAppointment}
                disabled={submitting || !!error || isExpired}
                className="w-full py-3.5 px-6 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:hover:bg-teal-700 text-white font-bold text-[14px] rounded-xl shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    Xác nhận đặt lịch
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Footer */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white border-t border-slate-200 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Xác nhận</span>
          <span className="text-[13px] font-extrabold text-slate-900">
            {slotStartTime ? format(new Date(slotStartTime), 'HH:mm - dd/MM') : 'Đang chọn'}
          </span>
          <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${isWarning ? 'text-orange-600 animate-pulse' : 'text-teal-700'}`}>
            <Clock className="w-3.5 h-3.5" /> Khung giờ: {minutes}:{seconds < 10 ? '0' : ''}{seconds}
          </span>
        </div>
        <button
          type="button"
          onClick={handleConfirmAppointment}
          disabled={submitting || !!error || isExpired}
          className="flex-1 max-w-[160px] py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-[13px] rounded-xl shadow-md shadow-teal-900/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Đang xử lý...</span>
            </>
          ) : (
            <>
              Xác nhận
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
