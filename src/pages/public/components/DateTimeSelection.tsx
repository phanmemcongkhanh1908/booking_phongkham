import React, { useState, useEffect, useRef } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
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
  UserCheck, 
  Lock, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useHoldSlot, Slot } from '../../../hooks/useHoldSlot';

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
  const { serviceId, serviceName, serviceDuration, providerId: storeProviderId, setStep, slotStartTime: storeSlotStartTime } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const { isHeldByMe, holdSlot, holdingSlotStart, activeSlotStartTime } = useHoldSlot();
  const fetchRequestIdRef = useRef<number>(0);
  
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

  // 1. Fetch Providers
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
        }
      })
      .catch(err => console.error('Failed to load availability summary', err))
      .finally(() => setLoadingSummary(false));
  }, [serviceId, selectedProviderId]);

  // 3. Fetch specific day's slots (Chống Race Condition bằng fetchRequestIdRef)
  useEffect(() => {
    if (!serviceId) return;
    fetchSlots(selectedDate);
  }, [selectedDate, serviceId, selectedProviderId]);

  const fetchSlots = async (date: Date) => {
    const currentReqId = ++fetchRequestIdRef.current;
    setLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const res = await api.get('/public/availability', {
        params: {
          serviceId,
          providerId: selectedProviderId || undefined,
          date: formattedDate,
          includeUnavailable: 'true',
        }
      });

      // Chỉ cập nhật nếu là response của request mới nhất
      if (currentReqId === fetchRequestIdRef.current && res.data.success) {
        let rawSlots: Slot[] = res.data.data || [];

        // Ghép slot đang được chính mình giữ vào lưới (nếu cùng ngày và còn hạn)
        const isDateOfMyHold = activeSlotStartTime && 
          format(parseISO(activeSlotStartTime), 'yyyy-MM-dd') === formattedDate && 
          isHeldByMe(activeSlotStartTime);

        if (isDateOfMyHold && activeSlotStartTime) {
          const found = rawSlots.find(s => s.startAt === activeSlotStartTime);
          if (found) {
            found.isMyHeld = true;
            found.isAvailable = true;
          } else {
            rawSlots.push({
              startAt: activeSlotStartTime,
              endAt: useBookingStore.getState().slotEndTime || activeSlotStartTime,
              providerId: useBookingStore.getState().providerId || selectedProviderId || (providers[0]?.id || ''),
              isAvailable: true,
              isMyHeld: true,
            });
            rawSlots.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
          }
        }

        setSlots(rawSlots);

        // Nếu slot đang giữ của mình nằm trong ngày này và chưa chọn slot khác, tự động chọn sẵn
        if (isDateOfMyHold && activeSlotStartTime) {
          const mySlot = rawSlots.find(s => s.startAt === activeSlotStartTime);
          if (mySlot) {
            setSelectedSlot(mySlot);
          }
        }
      }
    } catch (error) {
      if (currentReqId === fetchRequestIdRef.current) {
        console.error('Error fetching slots', error);
        setSlots([]);
      }
    } finally {
      if (currentReqId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // 3.1: Bấm slot chỉ lưu UI state (không gọi hold tự động)
  const handleSlotClick = (slot: Slot) => {
    const isMine = slot.isMyHeld || isHeldByMe(slot.startAt, slot.endAt);
    if (slot.isAvailable === false && !isMine) return;
    setSelectedSlot(slot);
  };

  // Bấm "Tiếp tục" mới gọi hold slot (hoặc tái sử dụng phiên hợp lệ qua useHoldSlot)
  const handleContinue = async () => {
    if (!selectedSlot) {
      toast.error('Vui lòng chọn một khung giờ khám trước khi tiếp tục');
      return;
    }

    const foundProvider = providers.find(p => p.id === selectedSlot.providerId);
    const providerName = foundProvider 
      ? `${foundProvider.title ? foundProvider.title + ' ' : ''}${foundProvider.name}` 
      : undefined;

    const res = await holdSlot(
      {
        providerId: selectedSlot.providerId,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt
      },
      format(selectedDate, 'yyyy-MM-dd'),
      providerName
    );

    if (res.success) {
      setStep(3);
      navigate('/book/thong-tin');
    } else {
      // Làm mới lại danh sách slot nếu slot bị conflict
      fetchSlots(selectedDate);
    }
  };

  const scrollDates = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
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
  const availableSlotsList = slots.filter(s => s.isAvailable !== false || s.isMyHeld || isHeldByMe(s.startAt, s.endAt));
  const isSelectedDateFull = selectedDaySummary ? selectedDaySummary.isFull : (slots.length > 0 && availableSlotsList.length === 0);

  // Group slots
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
    const isMine = slot.isMyHeld || isHeldByMe(slot.startAt, slot.endAt);
    const isSelected = selectedSlot?.startAt === slot.startAt;
    const isAvailable = (slot.isAvailable !== false) || isMine;
    const isHolding = holdingSlotStart === slot.startAt;
    const isHeld = !isMine && !isAvailable && slot.unavailableReason === 'HELD';
    const isPast = !isAvailable && slot.unavailableReason === 'PAST';

    // Trường hợp đang được chính người dùng giữ chỗ (Lỗi 2 & Lỗi 1 đã xử lý)
    if (isMine) {
      return (
        <button
          key={idx}
          type="button"
          onClick={() => handleSlotClick(slot)}
          title={`Khung giờ ${startTime} đang được giữ chỗ cho bạn`}
          className={`relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center font-bold transition-all duration-200 min-h-[58px] cursor-pointer shadow-xs ${
            isSelected
              ? 'border-2 border-teal-700 bg-teal-800 text-white shadow-md ring-2 ring-teal-600/40 scale-105 z-10'
              : 'border-2 border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/80 hover:border-emerald-500'
          }`}
        >
          <div className={`flex items-center gap-1 text-sm font-black ${isSelected ? 'text-white' : 'text-emerald-950'}`}>
            <Check className="w-3.5 h-3.5" />
            <span>{startTime}</span>
          </div>
          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded-md mt-1 ${
            isSelected 
              ? 'bg-teal-900 text-teal-100 border border-teal-700' 
              : 'bg-emerald-100/90 text-emerald-800 border border-emerald-300'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Đang giữ cho bạn
          </span>
        </button>
      );
    }

    // Trường hợp người khác đang giữ chỗ
    if (isHeld) {
      return (
        <div
          key={idx}
          title={`Khung giờ ${startTime} đang có khách hàng khác tạm giữ trong 5 phút`}
          className="relative flex flex-col items-center justify-center rounded-xl border border-amber-300 bg-amber-50/90 py-2.5 px-1 text-center font-medium text-amber-900 select-none min-h-[58px] shadow-2xs group opacity-85"
        >
          <div className="flex items-center gap-1 text-amber-950 font-black text-sm">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>{startTime}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-tight text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md border border-amber-300/80 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Đang giữ chỗ 5p
          </span>
        </div>
      );
    }

    // Khung giờ đã kín hoặc đã qua
    if (!isAvailable) {
      return (
        <button
          key={idx}
          type="button"
          disabled={true}
          title={isPast ? `Khung giờ ${startTime} đã qua` : `Khung giờ ${startTime} đã kín chỗ`}
          className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-100/70 py-3 px-1 text-center font-medium text-slate-400 opacity-60 cursor-not-allowed select-none min-h-[56px]"
        >
          <span className="text-sm font-semibold line-through text-slate-400">{startTime}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
            {isPast ? 'Đã qua' : 'Đã kín'}
          </span>
        </button>
      );
    }

    // Khung giờ khả dụng (Bấm để chọn - chỉ cập nhật state UI)
    return (
      <button
        key={idx}
        type="button"
        onClick={() => handleSlotClick(slot)}
        className={`group relative flex flex-col items-center justify-center rounded-xl py-3 px-1 text-center font-semibold transition-all duration-200 min-h-[56px] cursor-pointer focus:outline-none ${
          isSelected
            ? 'border-2 border-teal-700 bg-teal-700 text-white shadow-md shadow-teal-900/20 scale-105 z-10'
            : 'border border-teal-200/90 bg-white text-slate-800 hover:border-teal-600 hover:bg-teal-50/70 shadow-xs hover:-translate-y-0.5'
        }`}
      >
        <span className={`text-base font-extrabold transition-colors ${isSelected ? 'text-white' : 'text-slate-800 group-hover:text-teal-900'}`}>
          {startTime}
        </span>
        <span className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-teal-700 group-hover:text-teal-900'}`}>
          {isSelected ? 'Đang chọn' : 'Chọn giờ này'}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      {/* Step Header Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => { setStep(1); navigate('/book/dich-vu'); }}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0 transition-colors mt-0.5 cursor-pointer"
              title="Quay lại chọn dịch vụ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60 mb-2">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-700" />
                Bước 2 / 4
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Chọn Ngày & Giờ Khám
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs font-bold px-2.5 py-1 bg-teal-50 text-teal-900 rounded-lg border border-teal-200/80">
                  Dịch vụ: {serviceName || 'Nha khoa'}
                </span>
                {serviceDuration && (
                  <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                    Thời lượng: ~{serviceDuration} phút
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <Lock className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Chọn giờ phù hợp và bấm Tiếp tục để giữ chỗ</span>
          </div>
        </div>
      </div>

      {/* Doctor Selection (if multiple providers exist) */}
      {providers.length > 1 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-teal-700" />
            Bác sĩ phụ trách điều trị
          </label>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedProviderId(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                selectedProviderId === null
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              Tất cả bác sĩ (Xếp lịch nhanh nhất)
            </button>
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProviderId(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  selectedProviderId === p.id
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {p.title ? `${p.title} ` : 'BS. '}{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date Ribbon Selection */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-700" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Lịch khám trong 28 ngày tới
              </h3>
              <p className="text-xs text-slate-500">
                Tháng {format(selectedDate, 'MM/yyyy')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollDates('left')}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
              title="Xem ngày trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollDates('right')}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
              title="Xem ngày tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 28-Day Timeline Ribbon */}
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
                className={`snap-center flex shrink-0 flex-col items-center justify-between py-2.5 px-2 rounded-2xl border-2 transition-all duration-200 focus:outline-none cursor-pointer ${
                  isSelected 
                    ? 'border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-900/20 scale-105 z-10' 
                    : isFull
                      ? 'border-slate-200 bg-slate-100/70 text-slate-400 opacity-60 hover:opacity-90 hover:border-slate-300'
                      : 'border-slate-200/90 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50/50'
                }`}
                style={{ width: '76px', height: '98px' }}
              >
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  isSelected ? 'text-teal-100' : isFull ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {VIETNAMESE_DAYS[date.getDay()]}
                </span>

                <span className={`text-2xl font-black leading-none my-0.5 ${
                  isSelected ? 'text-white' : isFull ? 'text-slate-400' : 'text-slate-900'
                }`}>
                  {format(date, 'dd')}
                </span>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-tight truncate w-full text-center ${
                  isSelected
                    ? isFull 
                      ? 'bg-red-500/80 text-white' 
                      : 'bg-white/20 text-white'
                    : isFull
                      ? 'text-red-600 bg-red-50 font-bold'
                      : typeof count === 'number'
                        ? 'text-teal-800 bg-teal-50 font-bold'
                        : 'text-slate-400'
                }`}>
                  {isFull ? 'Hết chỗ' : typeof count === 'number' ? `Còn ${count}` : `Th ${format(date, 'MM')}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected date overview badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span className="font-bold text-slate-900 text-sm">
            {VIETNAMESE_FULL_DAYS[selectedDate.getDay()]}, {format(selectedDate, 'dd/MM/yyyy')}
          </span>
          {selectedDaySummary && (
            <span className={`font-semibold px-2.5 py-1 rounded-full ${
              selectedDaySummary.isFull 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {selectedDaySummary.isFull ? 'Hôm nay đã kín ca khám' : `Còn ${selectedDaySummary.availableSlotsCount} khung giờ tiếp nhận`}
            </span>
          )}
        </div>
      </div>

      {/* Suggestion banner if day is FULL */}
      {isSelectedDateFull && (
        <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                {VIETNAMESE_FULL_DAYS[selectedDate.getDay()]}, {format(selectedDate, 'dd/MM/yyyy')} đã kín lịch hẹn
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {nextAvailableDateStr ? (
                  <>
                    Ngày gần nhất còn chỗ trống là{' '}
                    <strong className="underline font-bold">
                      {VIETNAMESE_FULL_DAYS[parseISO(nextAvailableDateStr).getDay()]}, {format(parseISO(nextAvailableDateStr), 'dd/MM/yyyy')}
                    </strong>{' '}
                    (còn {nextAvailableCount} chỗ).
                  </>
                ) : (
                  'Các ca khám trong dải ngày này đã kín. Vui lòng chọn dải ngày khác hoặc liên hệ hotline phòng khám để được hỗ trợ.'
                )}
              </p>
            </div>
          </div>

          {nextAvailableDateStr && (
            <button
              type="button"
              onClick={handleJumpToNextAvailable}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 w-full sm:w-auto justify-center cursor-pointer"
            >
              <CalendarCheck2 className="w-4 h-4" />
              Chuyển sang ngày {format(parseISO(nextAvailableDateStr), 'dd/MM')}
            </button>
          )}
        </div>
      )}

      {/* Time Slots Area */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/30 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700" />
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
              Khung Giờ Khám Khả Dụng
            </h3>
            <button
              type="button"
              onClick={() => fetchSlots(selectedDate)}
              disabled={loading}
              title="Làm mới tình trạng khung giờ"
              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition-colors ml-1 focus:outline-none cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-700' : ''}`} />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block"></span>
              <span className="font-medium text-slate-700">Có thể đặt</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span className="font-bold text-emerald-800">Đang giữ cho bạn</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
              <span className="font-medium text-amber-700">Khách khác giữ (5p)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
              <span className="font-medium text-slate-400">Đã kín</span>
            </span>
          </div>
        </div>

        {slots.some(s => s.unavailableReason === 'HELD' && !s.isMyHeld && !isHeldByMe(s.startAt, s.endAt)) && (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed animate-in fade-in duration-200">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Khung giờ có khách đang thao tác: </span>
              Các khung giờ có nhãn <strong className="text-amber-950 font-extrabold">"Đang giữ chỗ 5p"</strong> đang có bệnh nhân khác lựa chọn trong 5 phút. Khung giờ sẽ mở lại ngay nếu bệnh nhân đó không hoàn tất đặt lịch.
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-teal-700 animate-spin" />
            <p className="text-sm text-slate-600 font-semibold">Đang cập nhật lịch ca trực của bác sĩ...</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 py-12 px-4 text-center border border-dashed border-slate-200 space-y-3">
            <div className="w-14 h-14 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
              <Clock className="w-7 h-7" />
            </div>
            <h4 className="text-slate-800 font-bold">Không có ca tiếp nhận trong ngày này</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Bác sĩ không có ca trực hoặc phòng khám không làm việc vào ngày này. Vui lòng chọn ngày khác ở thanh lịch phía trên.
            </p>
            {nextAvailableDateStr && (
              <button
                type="button"
                onClick={handleJumpToNextAvailable}
                className="mt-2 text-xs font-bold text-teal-800 border border-teal-700/30 hover:bg-teal-50 px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarCheck2 className="w-4 h-4" />
                Xem ngày còn chỗ gần nhất ({format(parseISO(nextAvailableDateStr), 'dd/MM')})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sáng: Trước 12h */}
            {morningSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Buổi sáng (08:00 - 12:00)</span>
                  </div>
                  <span className="text-teal-800 font-semibold">
                    {morningSlots.filter(s => s.isAvailable !== false || s.isMyHeld || isHeldByMe(s.startAt, s.endAt)).length} chỗ trống
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {morningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Chiều: 12h - 17h */}
            {afternoonSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sunset className="w-4 h-4 text-orange-500" />
                    <span>Buổi chiều (12:00 - 17:00)</span>
                  </div>
                  <span className="text-teal-800 font-semibold">
                    {afternoonSlots.filter(s => s.isAvailable !== false || s.isMyHeld || isHeldByMe(s.startAt, s.endAt)).length} chỗ trống
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {afternoonSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Tối: Sau 17h */}
            {eveningSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span>Buổi tối (17:00 - 21:00)</span>
                  </div>
                  <span className="text-teal-800 font-semibold">
                    {eveningSlots.filter(s => s.isAvailable !== false || s.isMyHeld || isHeldByMe(s.startAt, s.endAt)).length} chỗ trống
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {eveningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3.1: Bottom Action Bar - Tiếp tục sang bước điền thông tin (Desktop) */}
        <div className="hidden sm:flex pt-4 border-t border-slate-200/80 flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            {selectedSlot ? (
              <span className="font-semibold text-slate-900 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Check className="w-4 h-4 text-teal-700" />
                Đã chọn: <strong className="text-teal-950 font-black">{format(new Date(selectedSlot.startAt), 'HH:mm')}</strong> - {format(selectedDate, 'dd/MM/yyyy')}
              </span>
            ) : (
              <span className="text-slate-500 italic">
                Chưa chọn khung giờ. Vui lòng bấm vào một ô giờ ở trên.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedSlot || Boolean(holdingSlotStart)}
            onClick={handleContinue}
            className="w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm shadow-md shadow-teal-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {holdingSlotStart ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý giữ chỗ...</span>
              </>
            ) : (
              <>
                <span>Tiếp tục điền hồ sơ</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sticky Mobile Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã chọn</span>
          {selectedSlot ? (
            <span className="text-xs font-bold text-teal-800 flex items-center gap-1">
              <Check className="w-3 h-3 text-teal-600" />
              {format(new Date(selectedSlot.startAt), 'HH:mm - dd/MM/yyyy')}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-500 italic">
              Chưa chọn giờ
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!selectedSlot || Boolean(holdingSlotStart)}
          onClick={handleContinue}
          className="py-3 px-5 bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {holdingSlotStart ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Xử lý...</span>
            </>
          ) : (
            <>
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

