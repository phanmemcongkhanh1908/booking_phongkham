import React, { useState, useEffect, useRef } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { toast } from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ArrowLeft, 
  Loader2, 
  Sun, 
  Sunset, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  CalendarCheck2, 
  UserCheck 
} from 'lucide-react';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Slot {
  startAt: string;
  endAt: string;
  score?: number;
  providerId: string;
  isAvailable?: boolean;
  unavailableReason?: 'BOOKED' | 'HELD' | 'PAST';
}

interface DaySummary {
  date: string;
  dayOfWeek: number;
  availableSlotsCount: number;
  isFull: boolean;
}

interface Provider {
  id: string;
  name: string;
  title?: string;
  isActive: boolean;
}

const VIETNAMESE_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VIETNAMESE_FULL_DAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function DateTimeSelection() {
  const { serviceId, serviceName, providerId: storeProviderId, setDateTimeSlot, setStep } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [holdingSlotStart, setHoldingSlotStart] = useState<string | null>(null);
  
  // 28-day availability summary
  const [summaryMap, setSummaryMap] = useState<Record<string, DaySummary>>({});
  const [nextAvailableDateStr, setNextAvailableDateStr] = useState<string | null>(null);
  const [nextAvailableCount, setNextAvailableCount] = useState<number>(0);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Providers
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(storeProviderId || null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Generate 28 next days
  const nextDays = Array.from({ length: 28 }).map((_, i) => addDays(startOfToday(), i));

  // 1. Fetch Providers (only show selector if > 1 provider)
  useEffect(() => {
    api.get('/public/providers')
      .then(res => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const active = res.data.data.filter((p: any) => p.isActive);
          setProviders(active);
        }
      })
      .catch(err => console.error('Failed to load providers', err));
  }, []);

  // 2. Fetch 28-day Availability Summary
  useEffect(() => {
    if (!serviceId) return;

    setLoadingSummary(true);
    const startDateStr = format(startOfToday(), 'yyyy-MM-dd');
    
    api.get('/public/availability/summary', {
      params: {
        serviceId,
        providerId: selectedProviderId || undefined,
        startDate: startDateStr,
        days: 28,
      }
    })
      .then(res => {
        if (res.data.success && res.data.data) {
          const { summary, nextAvailableDate, nextAvailableCount: nac } = res.data.data;
          const map: Record<string, DaySummary> = {};
          if (Array.isArray(summary)) {
            summary.forEach((s: DaySummary) => {
              map[s.date] = s;
            });
          }
          setSummaryMap(map);
          setNextAvailableDateStr(nextAvailableDate);
          setNextAvailableCount(nac || 0);

          // If current selected date has 0 slots, but next available exists, user can be prompted
        }
      })
      .catch(err => console.error('Failed to load availability summary', err))
      .finally(() => setLoadingSummary(false));
  }, [serviceId, selectedProviderId]);

  // 3. Fetch specific day's slots
  useEffect(() => {
    if (!serviceId) return;
    fetchSlots(selectedDate);
  }, [selectedDate, serviceId, selectedProviderId]);

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const res = await api.get('/public/availability', {
        params: {
          serviceId,
          providerId: selectedProviderId || undefined,
          date: formattedDate,
          includeUnavailable: 'true', // Get all slots to dim full slots
        }
      });
      if (res.data.success) {
        setSlots(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching slots', error);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = async (slot: Slot) => {
    if (slot.isAvailable === false) return;

    setHoldingSlotStart(slot.startAt);
    try {
      const res = await api.post('/public/appointments/hold', {
        serviceId, 
        providerId: slot.providerId,
        startAt: slot.startAt,
        endAt: slot.endAt
      });
      
      if (res.data.success) {
        setDateTimeSlot(
          format(selectedDate, 'yyyy-MM-dd'),
          slot.providerId,
          res.data.data.sessionToken,
          slot.startAt,
          slot.endAt,
          new Date(res.data.data.expiresAt).getTime()
        );
        navigate('/book/thong-tin');
      }
    } catch (error: any) {
      toast.error('Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.');
      fetchSlots(selectedDate);
    } finally {
      setHoldingSlotStart(null);
    }
  };

  const scrollDates = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleJumpToNextAvailable = () => {
    if (nextAvailableDateStr) {
      const targetDate = parseISO(nextAvailableDateStr);
      setSelectedDate(targetDate);
      toast.success(`Đã chuyển tới ngày còn chỗ sớm nhất: ${format(targetDate, 'dd/MM/yyyy')}`);
    }
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDaySummary = summaryMap[selectedDateStr];
  const availableSlotsList = slots.filter(s => s.isAvailable !== false);
  const isSelectedDateFull = selectedDaySummary ? selectedDaySummary.isFull : (slots.length > 0 && availableSlotsList.length === 0);

  // Group slots by Morning / Afternoon / Evening
  const morningSlots = slots.filter(s => {
    const hour = new Date(s.startAt).getHours();
    return hour < 12;
  });

  const afternoonSlots = slots.filter(s => {
    const hour = new Date(s.startAt).getHours();
    return hour >= 12 && hour < 17;
  });

  const eveningSlots = slots.filter(s => {
    const hour = new Date(s.startAt).getHours();
    return hour >= 17;
  });

  const renderSlotButton = (slot: Slot, idx: number) => {
    const startTime = format(new Date(slot.startAt), 'HH:mm');
    const isAvailable = slot.isAvailable !== false;
    const isHolding = holdingSlotStart === slot.startAt;

    if (!isAvailable) {
      return (
        <button
          key={idx}
          type="button"
          disabled={true}
          title={`Khung giờ ${startTime} đã kín chỗ`}
          aria-label={`Khung giờ ${startTime} đã kín chỗ`}
          className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-100/80 py-2.5 px-1 text-center font-medium text-slate-400 opacity-60 cursor-not-allowed select-none min-h-[50px]"
        >
          <span className="text-sm line-through text-slate-400">{startTime}</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter mt-0.5">
            Đã kín
          </span>
        </button>
      );
    }

    return (
      <button
        key={idx}
        type="button"
        disabled={Boolean(holdingSlotStart)}
        onClick={() => handleSelectSlot(slot)}
        title={`Chọn khung giờ ${startTime}`}
        aria-label={`Chọn khung giờ ${startTime}`}
        className="group relative flex flex-col items-center justify-center rounded-xl border border-teal-200/80 bg-white py-2.5 px-1 text-center font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:border-primary hover:bg-teal-50/70 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 min-h-[50px] focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {isHolding ? (
          <div className="flex items-center gap-1 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Giữ chỗ...</span>
          </div>
        ) : (
          <>
            <span className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
              {startTime}
            </span>
            <span className="text-[10px] font-medium text-teal-600 group-hover:text-teal-700">
              Có thể đặt
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:border-slate-200 sm:shadow-lg sm:shadow-slate-200/40 rounded-2xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center gap-4 text-center sm:text-left bg-gradient-to-b from-slate-50 to-white pb-6 border-b border-slate-100 p-4 md:p-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => { setStep(1); navigate('/book/dich-vu'); }} 
          className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors h-10 w-10"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <CardTitle className="text-xl md:text-2xl text-slate-800 font-bold">Chọn Ngày & Giờ Khám</CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-semibold px-2.5 py-1 bg-teal-50 text-teal-700 rounded-md border border-teal-100/70">
              {serviceName || 'Dịch vụ nha khoa'}
            </span>
            {selectedDaySummary && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                selectedDaySummary.isFull 
                  ? 'bg-red-50 text-red-600 border border-red-100' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
                {selectedDaySummary.isFull ? 'Ngày đã kín lịch' : `Còn ${selectedDaySummary.availableSlotsCount} chỗ trống`}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6 space-y-6">
        {/* Doctor Selector - only shown if > 1 provider */}
        {providers.length > 1 && (
          <div className="space-y-2 pb-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              Bác sĩ điều trị
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedProviderId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  selectedProviderId === null
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Tất cả bác sĩ (Xếp lịch nhanh nhất)
              </button>
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProviderId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    selectedProviderId === p.id
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.title ? `${p.title} ` : 'BS. '}{p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date Selector Header & Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-800">Chọn ngày khám</h3>
              <span className="text-xs text-slate-500 hidden sm:inline">(28 ngày tới)</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollDates('left')}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                title="Xem ngày trước"
                aria-label="Xem ngày trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollDates('right')}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                title="Xem ngày tiếp theo"
                aria-label="Xem ngày tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 28-Day Strip with explicit Text Status */}
          <div 
            ref={scrollContainerRef}
            className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-hide snap-x scroll-smooth" 
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {nextDays.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const isSelected = selectedDateStr === dateStr;
              const summary = summaryMap[dateStr];
              const isFull = summary ? summary.isFull : false;
              const count = summary ? summary.availableSlotsCount : undefined;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={isSelected}
                  className={`snap-center flex shrink-0 flex-col items-center justify-between py-2 px-1.5 rounded-xl border-2 transition-all duration-200 focus:outline-none ${
                    isSelected 
                      ? 'border-primary bg-primary text-white shadow-md shadow-teal-900/20 scale-105 z-10' 
                      : isFull
                        ? 'border-slate-200 bg-slate-100/70 text-slate-400 opacity-60 hover:opacity-90 hover:border-slate-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50'
                  }`}
                  style={{ width: '74px', height: '94px' }}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${
                    isSelected ? 'text-teal-100' : isFull ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {VIETNAMESE_DAYS[date.getDay()]}
                  </span>

                  <span className={`text-2xl font-black leading-none my-0.5 ${
                    isSelected ? 'text-white' : isFull ? 'text-slate-400' : 'text-slate-800'
                  }`}>
                    {format(date, 'dd')}
                  </span>

                  {/* Explicit Text Status: "Còn X" hoặc "Hết chỗ" */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight truncate w-full text-center ${
                    isSelected
                      ? isFull 
                        ? 'bg-red-500/80 text-white' 
                        : 'bg-white/20 text-white'
                      : isFull
                        ? 'text-red-500 bg-red-50 font-semibold'
                        : typeof count === 'number'
                          ? 'text-teal-700 bg-teal-50 font-bold'
                          : 'text-slate-400'
                  }`}>
                    {isFull ? 'Hết chỗ' : typeof count === 'number' ? `Còn ${count}` : `Th ${format(date, 'MM')}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Suggestion banner if selected day is FULL */}
        {isSelectedDateFull && (
          <div className="rounded-xl bg-amber-50/90 border border-amber-200/80 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  {VIETNAMESE_FULL_DAYS[selectedDate.getDay()]}, {format(selectedDate, 'dd/MM/yyyy')} đã kín lịch
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {nextAvailableDateStr ? (
                    <>
                      Ngày gần nhất còn lịch trống là{' '}
                      <strong className="underline font-bold">
                        {VIETNAMESE_FULL_DAYS[parseISO(nextAvailableDateStr).getDay()]}, {format(parseISO(nextAvailableDateStr), 'dd/MM/yyyy')}
                      </strong>{' '}
                      (còn {nextAvailableCount} chỗ).
                    </>
                  ) : (
                    'Các ngày lân cận hiện tại cũng đang kín, vui lòng chọn dải ngày khác hoặc liên hệ hotline phòng khám.'
                  )}
                </p>
              </div>
            </div>

            {nextAvailableDateStr && (
              <Button
                type="button"
                size="sm"
                onClick={handleJumpToNextAvailable}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm w-full sm:w-auto"
              >
                <CalendarCheck2 className="w-4 h-4 mr-1.5" />
                Chuyển sang ngày {format(parseISO(nextAvailableDateStr), 'dd/MM')}
              </Button>
            )}
          </div>
        )}

        {/* Time Slots Area */}
        <div className="space-y-5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-800">Khung giờ khám</h3>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                Còn trống
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
                Đã kín (làm mờ)
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-slate-500 font-medium">Đang tải lịch bác sĩ...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-10 px-4 text-center border border-dashed border-slate-200">
              <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                <Clock className="w-7 h-7" />
              </div>
              <p className="text-slate-700 font-semibold">Không có ca khám trong ngày này</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Bác sĩ không có ca trực hoặc phòng khám nghỉ làm việc vào ngày này. Vui lòng chọn ngày khác ở thanh ngày bên trên.
              </p>
              {nextAvailableDateStr && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleJumpToNextAvailable}
                  className="mt-4 text-xs text-primary border-primary hover:bg-primary/5"
                >
                  <CalendarCheck2 className="w-4 h-4 mr-1.5" />
                  Xem ngày còn chỗ gần nhất ({format(parseISO(nextAvailableDateStr), 'dd/MM')})
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sáng: Trước 12h */}
              {morningSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Buổi sáng (08:00 - 12:00)</span>
                    <span className="text-slate-400 font-normal ml-auto">
                      {morningSlots.filter(s => s.isAvailable !== false).length} chỗ trống
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                    {morningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                  </div>
                </div>
              )}

              {/* Chiều: 12h - 17h */}
              {afternoonSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <Sunset className="w-4 h-4 text-orange-500" />
                    <span>Buổi chiều (12:00 - 17:00)</span>
                    <span className="text-slate-400 font-normal ml-auto">
                      {afternoonSlots.filter(s => s.isAvailable !== false).length} chỗ trống
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                    {afternoonSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                  </div>
                </div>
              )}

              {/* Tối: Sau 17h */}
              {eveningSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span>Buổi tối (17:00 - 21:00)</span>
                    <span className="text-slate-400 font-normal ml-auto">
                      {eveningSlots.filter(s => s.isAvailable !== false).length} chỗ trống
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                    {eveningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
