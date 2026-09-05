import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { toast } from 'react-hot-toast';
import { Calendar as CalendarIcon, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { format, addDays, startOfToday } from 'date-fns';

interface Slot {
  startAt: string;
  endAt: string;
  score: number;
  providerId: string;
}

// Define a simple mapping array for Vietnamese days
const getVietnameseDay = (date: Date) => {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return days[date.getDay()];
};

export default function DateTimeSelection() {
  const { serviceId, serviceName, setDateTimeSlot, setStep } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);

  // Sinh danh sách 7 ngày tiếp theo để chọn
  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i));

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate, serviceId]);

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      // Gọi API lấy giờ trống từ backend Phase 5
      const res = await api.get('/public/availability', {
        params: {
          serviceId: serviceId, // Now it's a real UUID from ServiceSelection
          date: formattedDate,
        }
      });
      if (res.data.success) {
        setSlots(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching slots', error);
      // Fallback cho UI dev
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = async (slot: Slot) => {
    setHolding(true);
    try {
      // Giữ chỗ (Hold Slot) 5 phút
      const res = await api.post('/public/appointments/hold', {
        serviceId: serviceId, 
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
      }
    } catch (error) {
      toast.error("Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.");
      fetchSlots(selectedDate); // Refresh slots
    } finally {
      setHolding(false);
    }
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:border-slate-200 sm:shadow-lg sm:shadow-slate-200/40 rounded-2xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center gap-4 text-center sm:text-left bg-gradient-to-b from-slate-50 to-white pb-6 border-b border-slate-100 p-4 md:p-6">
        <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors h-10 w-10">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <CardTitle className="text-xl md:text-2xl text-slate-800 font-bold">Chọn Ngày & Giờ</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium px-2 py-1 bg-teal-50 text-teal-700 rounded-md">
              {serviceName}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        {/* Date Selector (Horizontal Scroll) */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-800">Ngày khám</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
            {nextDays.map((date) => {
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`snap-center flex shrink-0 flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
                    isSelected 
                      ? 'border-primary bg-primary text-white shadow-lg shadow-teal-900/20 scale-105' 
                      : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50'
                  }`}
                  style={{ width: '72px', height: '88px' }}
                >
                  <span className={`text-[11px] font-medium tracking-wide uppercase ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                    {getVietnameseDay(date)}
                  </span>
                  <span className="text-2xl font-bold my-0.5">{format(date, 'dd')}</span>
                  <span className={`text-[11px] font-medium ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                    Th {format(date, 'MM')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-6 mt-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-800">Khung giờ trống</h3>
          </div>
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-slate-500 font-medium">Đang tìm lịch trống...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-12 px-4 text-center border border-dashed border-slate-200">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-600 font-medium">Không có giờ trống trong ngày này.</p>
              <p className="text-sm text-slate-400 mt-1">Vui lòng chọn một ngày khác ở trên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:gap-4 sm:grid-cols-4">
              {slots.map((slot, idx) => {
                const startTime = format(new Date(slot.startAt), 'HH:mm');
                return (
                  <button
                    key={idx}
                    disabled={holding}
                    onClick={() => handleSelectSlot(slot)}
                    className="relative overflow-hidden group flex items-center justify-center rounded-xl border border-slate-200 bg-white py-3 md:py-3.5 text-center font-semibold text-slate-700 transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:bg-teal-50 disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
                  >
                    <span className="relative z-10">{startTime}</span>
                    <div className="absolute inset-0 bg-teal-50/0 group-hover:bg-teal-50/100 transition-colors duration-300 z-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
