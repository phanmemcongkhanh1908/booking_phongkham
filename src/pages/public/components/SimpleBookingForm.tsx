import React, { useState, useEffect, useRef } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Stethoscope, Calendar as CalendarIcon, Clock, User, Phone, Mail, FileText, Send, Loader2, Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, CalendarCheck,
  ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const VIETNAMESE_DAYS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const VIETNAMESE_FULL_DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

interface Service {
  id: string;
  name: string;
  durationMins: number;
  price: number;
  description?: string;
  showPrice?: boolean;
}

interface Slot {
  startAt: string;
  endAt: string;
  isAvailable: boolean;
  isMyHeld: boolean;
  providerId: string;
}

export default function SimpleBookingForm() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const basePath = slug ? `/booking/${slug}` : '/book';
  
  // States
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  
  const [selectedService, setSelectedService] = useState<string | null>(null);
  
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
  });
  
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'new' | 'existing_unverified' | 'verified'>('idle');
  const [verifyName, setVerifyName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastServiceId, setLastServiceId] = useState<string | null>(null);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSession, setActiveSession] = useState<{ token: string, startAt: string, endAt: string, expiresAt: number } | null>(null);
  
  const bookingFormConfig = useBookingStore(s => s.bookingFormConfig);
  const clinicProfile = useBookingStore(s => s.clinicProfile);
  const setStepStore = useBookingStore(s => s.setStep);
  const setAppointmentSuccess = useBookingStore(s => s.setAppointmentSuccess);

  const clinicDisplayName = clinicProfile?.clinicName || clinicProfile?.name || 'Đặt Lịch Khám Nha Khoa';
  const doctorDisplayName = clinicProfile?.doctorName ? (
    clinicProfile.doctorName.startsWith('Bs') || clinicProfile.doctorName.startsWith('BS')
      ? clinicProfile.doctorName
      : `BS. ${clinicProfile.doctorName}`
  ) : null;
  
  const nextDays = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i));
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollDates = (direction: 'left' | 'right') => {
    if (dateScrollRef.current) {
      const scrollAmount = 260;
      dateScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    // 1. Fetch Services
    api.get('/public/services')
      .then(res => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setServices(res.data.data);
        }
      })
      .finally(() => setLoadingServices(false));
  }, []);

  useEffect(() => {
    // 2. Fetch Slots when service or date changes
    if (!selectedService) {
      setSlots([]);
      return;
    }
    
    setLoadingSlots(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    api.get('/public/availability', {
      params: {
        serviceId: selectedService,
        date: formattedDate,
      }
    }).then(res => {
      if (res.data.success) {
        setSlots(res.data.data || []);
      }
    }).finally(() => {
      setLoadingSlots(false);
    });
  }, [selectedService, selectedDate]);

  useEffect(() => {
    const rawClean = formData.phone.replace(/\D/g, '');
    const isValid = /^\d{10,11}$/.test(rawClean);
    
    if (!isValid) {
      setPhoneStatus('idle');
      return;
    }
    
    if (phoneStatus === 'verified') return;

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    
    checkTimerRef.current = setTimeout(async () => {
      setPhoneStatus('checking');
      try {
        const res = await api.get('/public/patients/check', {
          params: { phone: rawClean }
        });
        if (res.data?.success) {
          if (res.data.exists) {
            setPhoneStatus('existing_unverified');
          } else {
            setPhoneStatus('new');
          }
        }
      } catch (err) {
        console.error("Lỗi kiểm tra SĐT", err);
        setPhoneStatus('new'); // Fallback
      }
    }, 600);
    
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [formData.phone]);

  const handleVerifyName = async () => {
    if (!verifyName.trim()) {
      toast.error("Vui lòng nhập họ tên để xác thực.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await api.post('/public/patients/verify', {
        phone: formData.phone,
        fullName: verifyName
      });
      if (res.data?.success && res.data?.match && res.data?.data) {
        const p = res.data.data;
        setFormData(prev => ({
          ...prev,
          fullName: p.fullName || prev.fullName,
          email: p.email || prev.email,
          notes: p.notes || prev.notes
        }));
        setPhoneStatus('verified');
        toast.success("Xác thực thành công! Đã tự động điền thông tin của bạn.");
        if (p.lastServiceId && !selectedService) {
           // Gợi ý dịch vụ cũ
           setLastServiceId(p.lastServiceId);
           setSelectedService(p.lastServiceId);
           toast.success(`Hệ thống đã tự động chọn dịch vụ: ${p.lastServiceName}`);
        }
      } else {
        toast.error("Tên không khớp với hồ sơ, vui lòng thử lại hoặc dùng số điện thoại khác.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xác thực.");
    } finally {
      setIsVerifying(false);
    }
  };

  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!navigator.onLine) {
      toast.error('Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng và thử lại.');
      return;
    }

    if (!selectedService || !selectedSlot) {
      toast.error('Vui lòng chọn dịch vụ và thời gian khám');
      return;
    }
    if (!formData.fullName || !formData.phone) {
      toast.error('Vui lòng nhập tên và số điện thoại');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      let sessionToken = activeSession?.token;
      
      // If no session or session expired or different slot, hold new slot
      if (!sessionToken || activeSession?.startAt !== selectedSlot.startAt || Date.now() + 5000 > (activeSession?.expiresAt || 0)) {
        const holdRes = await api.post('/public/appointments/hold', {
          providerId: selectedSlot.providerId,
          serviceId: selectedService,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt
        });
        
        if (!holdRes.data.success) {
          throw new Error('Khung giờ này đã có người đặt, vui lòng chọn lại.');
        }
        
        sessionToken = holdRes.data.data.sessionToken;
        setActiveSession({
          token: sessionToken,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          expiresAt: new Date(holdRes.data.data.expiresAt).getTime()
        });
      }

      const res = await api.post('/public/appointments', {
        sessionToken,
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email || "",
        notes: formData.notes
      });

      if (res.data.success) {
        const appointmentData = res.data.data;
        if (appointmentData && appointmentData.appointmentId) {
          localStorage.setItem('verifiedPatient', JSON.stringify({ phone: formData.phone, fullName: formData.fullName }));
        }

        const selectedServiceObj = services.find(s => s.id === selectedService);
        setAppointmentSuccess(
          appointmentData.appointmentId,
          formData.fullName,
          formData.phone,
          appointmentData.patientEmail,
          appointmentData.patientTelegramId,
          appointmentData.telegramBotUsername,
          {
            serviceName: appointmentData.serviceName || selectedServiceObj?.name || 'Khám răng nha khoa',
            serviceDuration: selectedServiceObj?.durationMins || 45,
            slotStartTime: appointmentData.startAt || selectedSlot?.startAt,
            slotEndTime: appointmentData.endAt || selectedSlot?.endAt,
            providerName: appointmentData.providerName || null,
          }
        );
        setStepStore(5);
        navigate(`${basePath}/hoan-tat`);
        toast.success('Đặt lịch thành công!');
      } else {
        toast.error('Khung giờ này đã có người đặt, vui lòng chọn lại.');
        // Refresh slots
        setSelectedSlot(null);
        setLoadingSlots(true);
        api.get('/public/availability', {
          params: { serviceId: selectedService, date: format(selectedDate, 'yyyy-MM-dd') }
        }).then(res2 => {
          if (res2.data.success) setSlots(res2.data.data || []);
          setLoadingSlots(false);
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error?.message || error.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Premium Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 font-semibold text-sm mb-2 shadow-sm">
          <Sparkles className="w-4 h-4" /> Dịch vụ Đặt hẹn Nhanh
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">{clinicDisplayName}</h2>
        {doctorDisplayName && (
          <p className="text-sm font-bold text-teal-800">
            Bác sĩ phụ trách: <span className="font-extrabold text-teal-950">{doctorDisplayName}</span>
          </p>
        )}
        <p className="text-base sm:text-lg text-slate-500 font-medium max-w-xl mx-auto">
          {clinicProfile?.slogan || 'Hoàn tất thủ tục đặt lịch nhanh chóng, tiện lợi chỉ với vài thao tác cơ bản.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur-xl p-4 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 ring-1 ring-slate-900/5 relative">
        
        {/* Step 1: Chọn dịch vụ */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-teal-500/20">
              1
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Chọn dịch vụ khám</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadingServices ? (
              <div className="col-span-full py-12 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                Đang tải danh sách dịch vụ...
              </div>
            ) : (
              services.map(svc => {
                const isSelected = selectedService === svc.id;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => { setSelectedService(svc.id); setSelectedSlot(null); }}
                    className={`group relative flex flex-col justify-center items-start p-5 rounded-2xl transition-all duration-300 outline-none overflow-hidden ${
                      isSelected 
                        ? 'bg-teal-50 ring-2 ring-teal-500 shadow-sm' 
                        : 'bg-slate-50/50 border border-slate-200 hover:border-teal-300 hover:bg-slate-50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full mb-2">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-teal-500 text-white shadow-sm' : 'bg-white text-slate-400 group-hover:text-teal-500 border border-slate-100'} transition-colors`}>
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-teal-500 animate-in zoom-in duration-200" />
                      )}
                    </div>
                    
                    <span className={`font-bold text-base sm:text-lg text-left leading-tight mt-1 ${isSelected ? 'text-teal-900' : 'text-slate-700'}`}>
                      {svc.name}
                    </span>
                    {svc.showPrice && <span className={`text-sm font-semibold mt-2 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`}>{svc.price.toLocaleString('vi-VN')} đ</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="h-8 sm:h-12" />

        {/* Step 2: Chọn thời gian */}
        <div className={`space-y-6 transition-all duration-500 ${!selectedService ? 'opacity-30 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-teal-500/20">
              2
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Chọn thời gian</h3>
          </div>
          
          <div className="space-y-5">
            {/* Timeline Ribbon Header with Month & Scroll Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-teal-600" />
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  Tháng {format(selectedDate, 'MM/yyyy')}
                </span>
                {format(selectedDate, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    Hôm nay
                  </span>
                )}
              </div>

              {/* Scroll controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleScrollDates('left')}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-teal-700 transition-colors shadow-2xs cursor-pointer"
                  title="Xem ngày trước"
                  aria-label="Xem ngày trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleScrollDates('right')}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-teal-700 transition-colors shadow-2xs cursor-pointer"
                  title="Xem ngày tiếp theo"
                  aria-label="Xem ngày tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Scroll for Dates */}
            <div 
              ref={dateScrollRef}
              className="flex gap-2.5 sm:gap-3 overflow-x-auto py-2.5 px-2 -mx-2 sm:mx-0 sm:px-1 scrollbar-hide snap-x snap-mandatory scroll-smooth touch-pan-x"
            >
              {nextDays.map(date => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                const isToday = format(date, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd');
                const isTomorrow = format(date, 'yyyy-MM-dd') === format(addDays(startOfToday(), 1), 'yyyy-MM-dd');
                const dayLabel = isToday ? 'Hôm nay' : isTomorrow ? 'Ngày mai' : VIETNAMESE_DAYS[date.getDay()];

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className={`snap-start flex-shrink-0 flex flex-col items-center justify-between w-[76px] sm:w-[84px] h-[98px] sm:h-[104px] p-2 sm:p-2.5 rounded-2xl outline-none transition-all duration-200 cursor-pointer select-none ${
                      isSelected 
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25 ring-2 ring-teal-500 ring-offset-2 ring-offset-white' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50/30 hover:shadow-2xs active:bg-slate-100'
                    }`}
                  >
                    <span className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md leading-tight text-center truncate w-full ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : isToday 
                          ? 'bg-teal-50 text-teal-700 font-extrabold' 
                          : 'text-slate-500'
                    }`}>
                      {dayLabel}
                    </span>

                    <span className={`text-2xl sm:text-3xl font-black leading-none my-0.5 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {format(date, 'dd')}
                    </span>

                    <span className={`text-[10px] sm:text-[11px] font-medium ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      Tháng {format(date, 'MM')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Date Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>{VIETNAMESE_FULL_DAYS[selectedDate.getDay()]}, ngày {format(selectedDate, 'dd/MM/yyyy')}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                slots.filter(s => s.isAvailable).length > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {loadingSlots ? 'Đang kiểm tra lịch...' : slots.filter(s => s.isAvailable).length > 0 ? `Còn ${slots.filter(s => s.isAvailable).length} giờ trống` : 'Hết ca khám'}
              </span>
            </div>

            {/* Time Slots Grid */}
            <div className="bg-slate-50/70 p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] border border-slate-200/80">
              {loadingSlots ? (
                <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
                  <span className="font-medium text-slate-600">Đang tìm các khung giờ tiếp nhận còn trống...</span>
                </div>
              ) : slots.filter(s => s.isAvailable).length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-teal-600" /> Khung giờ khám còn nhận
                    </span>
                    <span className="text-[11px] font-normal lowercase text-slate-400">
                      {slots.filter(s => s.isAvailable).length} khung giờ khả dụng
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {slots.filter(s => s.isAvailable).map(slot => {
                      const isSelected = selectedSlot?.startAt === slot.startAt;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`min-h-[46px] py-2.5 px-2 text-sm sm:text-base font-bold rounded-xl border outline-none transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20 ring-2 ring-teal-500 ring-offset-1'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/40 shadow-2xs'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          <span>{format(parseISO(slot.startAt), 'HH:mm')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      Không còn khung giờ trống vào ngày {format(selectedDate, 'dd/MM/yyyy')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Các bác sĩ đã kín lịch hoặc ngày này đã qua giờ tiếp nhận trực tuyến.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIndex = nextDays.findIndex(d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));
                      if (nextIndex >= 0 && nextIndex < nextDays.length - 1) {
                        setSelectedDate(nextDays[nextIndex + 1]);
                        setSelectedSlot(null);
                      } else {
                        setSelectedDate(addDays(selectedDate, 1));
                        setSelectedSlot(null);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs sm:text-sm font-semibold rounded-xl border border-teal-200 transition-colors cursor-pointer"
                  >
                    <span>Xem ngày tiếp theo ({format(addDays(selectedDate, 1), 'dd/MM')})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-8 sm:h-12" />

        {/* Step 3: Thông tin cá nhân */}
        <div className={`space-y-6 transition-all duration-500 ${!selectedSlot ? 'opacity-30 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-teal-500/20">
              3
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Thông tin liên hệ</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-5 sm:gap-6">
            {/* SĐT */}
            <div className="space-y-2 relative">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Số điện thoại <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  value={formData.phone || ''}
                  onChange={e => {
                    setFormData({...formData, phone: e.target.value});
                    if (phoneStatus === 'verified') setPhoneStatus('idle'); // reset if they type a new number
                  }}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                  placeholder="Nhập số điện thoại của bạn..."
                />
                {phoneStatus === 'checking' && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                )}
                {phoneStatus === 'verified' && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <CheckCircle2 className="w-5 h-5 text-teal-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Khối xác thực nếu là khách cũ */}
            {phoneStatus === 'existing_unverified' && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Khách hàng quen thuộc?</h4>
                    <p className="text-sm text-slate-600 mt-1">Số điện thoại này đã từng đặt khám. Vui lòng nhập <strong className="text-slate-800">Họ và Tên</strong> của bạn để hệ thống tự động điền hồ sơ.</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={verifyName || ''}
                      onChange={e => setVerifyName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleVerifyName())}
                      placeholder="Nhập họ và tên..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyName}
                    disabled={isVerifying}
                    className="whitespace-nowrap px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Xác thực
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoneStatus('new')}
                  className="text-xs text-blue-600 hover:underline font-medium inline-block"
                >
                  Bỏ qua, tôi muốn điền hồ sơ mới
                </button>
              </div>
            )}

            {/* Các trường còn lại chỉ hiện khi là khách mới hoặc đã verify */}
            {(phoneStatus === 'new' || phoneStatus === 'verified') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-2 relative">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Họ và tên <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.fullName || ''}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                      placeholder="Nhập đầy đủ họ tên"
                    />
                  </div>
                </div>
            
            {bookingFormConfig?.showNotificationChannels && (
              <div className="space-y-2 col-span-1 sm:col-span-2 relative">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Email <span className="text-slate-400 font-normal">(Tùy chọn)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                    placeholder="Nhận vé khám qua email"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Ghi chú <span className="text-slate-400 font-normal">(Tùy chọn)</span></label>
              <div className="relative">
                <div className="absolute top-4 left-0 pl-4 flex items-start pointer-events-none">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal min-h-[120px] resize-none bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                  placeholder="Mô tả triệu chứng hoặc yêu cầu đặc biệt..."
                />
              </div>
              {bookingFormConfig?.quickNotesTags && bookingFormConfig.quickNotesTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 ml-1">
                  {bookingFormConfig.quickNotesTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        notes: prev.notes ? `${prev.notes}, ${tag}` : tag 
                      }))}
                      className="px-3 py-1.5 bg-white text-slate-600 hover:text-teal-700 text-xs font-semibold rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-all shadow-sm active:scale-95"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        </div>

        <div className="mt-10 sm:mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Thông tin được bảo mật hoàn toàn
          </div>
          
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <p className="text-[12px] text-slate-500 leading-relaxed text-center">
            Bằng việc xác nhận, bạn đồng ý đến đúng giờ. Vui lòng thông báo hủy hoặc dời lịch trước <strong>24h</strong> nếu có thay đổi để phòng khám sắp xếp phục vụ bệnh nhân khác.
          </p>
        </div>

        {/* Mobile Sticky / Desktop static Button */}
        <div className="sticky bottom-0 left-0 right-0 sm:static bg-white/95 sm:bg-transparent p-4 sm:p-0 border-t sm:border-0 border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:shadow-none z-40 -mx-4 -mb-4 sm:mx-0 sm:mb-0 mt-2 sm:mt-0">
          <button
            type="submit"
            disabled={!selectedService || !selectedSlot || !formData.fullName || !formData.phone || isSubmitting || phoneStatus === 'existing_unverified' || phoneStatus === 'checking'}
            className="w-full sm:w-auto min-w-[280px] py-4 px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:transform-none text-base sm:text-lg outline-none focus:ring-4 focus:ring-teal-500/20"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý hồ sơ...</>
            ) : (
              <><Send className="w-5 h-5" /> XÁC NHẬN ĐẶT LỊCH HẸN</>
            )}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}
