import React, { useState, useEffect } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Calendar as CalendarIcon, Clock, ArrowLeft } from 'lucide-react';
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
          slot.endAt
        );
      }
    } catch (error) {
      alert("Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.");
      fetchSlots(selectedDate); // Refresh slots
    } finally {
      setHolding(false);
    }
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-soft">
      <CardHeader className="flex flex-row items-center gap-4 text-center sm:text-left space-y-0">
        <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="shrink-0 rounded-full bg-slate-100">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <CardTitle className="text-xl">Chọn Ngày & Giờ</CardTitle>
          <p className="text-sm text-text-muted">Dịch vụ: {serviceName}</p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Date Selector (Horizontal Scroll) */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {nextDays.map((date) => {
            const isSelected = format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex shrink-0 flex-col items-center justify-center rounded-card border p-3 transition-colors ${
                  isSelected 
                    ? 'border-primary bg-primary text-white shadow-md' 
                    : 'border-border-subtle bg-surface text-text-main hover:border-blue-300 hover:bg-bg-base'
                }`}
                style={{ width: '70px', height: '80px' }}
              >
                <span className="text-xs uppercase opacity-80">{getVietnameseDay(date)}</span>
                <span className="text-xl font-bold">{format(date, 'dd')}</span>
                <span className="text-xs opacity-80">Th {format(date, 'MM')}</span>
              </button>
            );
          })}
        </div>

        {/* Time Slots */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 font-medium text-text-main">
            <Clock size={18} className="text-primary" /> Giờ trống
          </h4>
          
          {loading ? (
            <div className="py-8 text-center text-text-muted">Đang tìm lịch trống...</div>
          ) : slots.length === 0 ? (
            <div className="rounded-lg bg-bg-base py-8 text-center text-text-muted border border-border-subtle">
              Không có giờ trống trong ngày này.<br/>Vui lòng chọn ngày khác.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {slots.map((slot, idx) => {
                const startTime = format(new Date(slot.startAt), 'HH:mm');
                return (
                  <button
                    key={idx}
                    disabled={holding}
                    onClick={() => handleSelectSlot(slot)}
                    className="rounded-lg border border-border-subtle bg-surface py-2 text-center font-medium text-teal-800 transition-colors hover:border-primary hover:bg-mint active:bg-teal-100 disabled:opacity-50"
                  >
                    {startTime}
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
