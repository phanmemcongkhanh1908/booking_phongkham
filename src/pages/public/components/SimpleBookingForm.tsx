import React, { useState, useEffect, useRef } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  Stethoscope, Calendar as CalendarIcon, Clock, User, Phone, Mail, FileText, Send, Loader2, Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, CalendarCheck
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const bookingFormConfig = useBookingStore(s => s.bookingFormConfig);
  const setStepStore = useBookingStore(s => s.setStep);
  const setAppointmentSuccess = useBookingStore(s => s.setAppointmentSuccess);
  
  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) {
      toast.error('Vui lòng chọn dịch vụ và thời gian khám');
      return;
    }
    if (!formData.fullName || !formData.phone) {
      toast.error('Vui lòng nhập tên và số điện thoại');
      return;
    }

    setIsSubmitting(true);
    try {
      const holdRes = await api.post('/public/appointments/hold', {
        providerId: selectedSlot.providerId,
        serviceId: selectedService,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt
      });
      
      if (!holdRes.data.success) {
        throw new Error('Khung giờ này đã có người đặt, vui lòng chọn lại.');
      }
      
      const sessionToken = holdRes.data.data.sessionToken;

      const res = await api.post('/public/appointments', {
        sessionToken,
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email || "",
        notes: formData.notes
      });

      if (res.data.success) {
        setAppointmentSuccess(
          res.data.data.appointmentId,
          formData.fullName,
          formData.phone,
          res.data.data.patientEmail,
          res.data.data.patientTelegramId,
          res.data.data.telegramBotUsername
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
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">Đặt Lịch Khám Nha Khoa</h2>
        <p className="text-base sm:text-lg text-slate-500 font-medium max-w-xl mx-auto">
          Hoàn tất thủ tục đặt lịch nhanh chóng, tiện lợi chỉ với vài thao tác cơ bản.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 ring-1 ring-slate-900/5 relative overflow-hidden">
        
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
          
          <div className="space-y-6">
            {/* Horizontal Scroll for Dates */}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
              {nextDays.map(date => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                const dayOfWeek = format(date, 'EEEE', { locale: vi });
                let shortDay = dayOfWeek.replace('thứ ', 'T').toUpperCase();
                if (dayOfWeek === 'chủ nhật') shortDay = 'CN';

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-[76px] h-[92px] sm:w-[84px] sm:h-[100px] rounded-[1.25rem] outline-none transition-all duration-300 relative overflow-hidden ${
                      isSelected 
                        ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 ring-2 ring-offset-2 ring-teal-500 scale-105' 
                        : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-teal-300 hover:bg-white hover:shadow-sm hover:-translate-y-0.5'
                    }`}
                  >
                    <span className={`text-[11px] sm:text-xs font-bold mb-1.5 uppercase tracking-wider ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      {shortDay}
                    </span>
                    <span className={`text-2xl sm:text-3xl font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                      {format(date, 'dd')}
                    </span>
                    <span className={`text-[10px] mt-1 font-medium ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      Tháng {format(date, 'MM')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Time Slots Grid */}
            <div className="bg-slate-50/50 p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] border border-slate-100">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {loadingSlots ? (
                  <div className="col-span-full py-8 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                    Đang tải lịch trống...
                  </div>
                ) : slots.length > 0 ? (
                  slots.filter(s => s.isAvailable).map(slot => {
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-3 px-2 text-sm sm:text-base font-bold rounded-xl border outline-none transition-all duration-300 flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:text-teal-700 hover:shadow-sm'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {format(parseISO(slot.startAt), 'HH:mm')}
                      </button>
                    )
                  })
                ) : (
                  <div className="col-span-full py-10 text-center flex flex-col items-center justify-center gap-2">
                    <CalendarCheck className="w-10 h-10 text-slate-300" />
                    <span className="text-sm font-medium text-slate-500">
                      Rất tiếc, không còn lịch trống trong ngày này
                    </span>
                  </div>
                )}
              </div>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-2 relative">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Họ và tên <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                  placeholder="Nhập đầy đủ họ tên"
                />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 ml-1">Số điện thoại <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
                  placeholder="Nhập số điện thoại"
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
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
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
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal min-h-[120px] resize-none bg-slate-50/50 hover:bg-white focus:bg-white shadow-sm"
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
        </div>

        <div className="mt-10 sm:mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Thông tin được bảo mật hoàn toàn
          </div>
          <button
            type="submit"
            disabled={!selectedService || !selectedSlot || !formData.fullName || !formData.phone || isSubmitting}
            className="w-full sm:w-auto min-w-[280px] py-4 px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:transform-none text-base sm:text-lg outline-none focus:ring-4 focus:ring-teal-500/20"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý hồ sơ...</>
            ) : (
              <><Send className="w-5 h-5" /> XÁC NHẬN ĐẶT LỊCH HẸN</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
