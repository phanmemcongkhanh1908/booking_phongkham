import React, { useState, useEffect } from 'react';
import { Loader2, XCircle, Edit3, CalendarCheck, Clock } from 'lucide-react';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';

interface Slot {
  startAt: string;
  endAt: string;
  isAvailable: boolean;
  providerId: string;
}

interface RescheduleModalProps {
  isOpen: boolean;
  appointmentId: string | null;
  serviceId: string | null;
  verifiedPhone: string;
  onClose: () => void;
  onSuccess: (appointmentId: string, newStartAt: string, newEndAt: string) => void;
}

export default function RescheduleModal({ isOpen, appointmentId, serviceId, verifiedPhone, onClose, onSuccess }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i));

  useEffect(() => {
    if (!isOpen || !serviceId) return;

    setLoadingSlots(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    api.get('/public/availability', {
      params: {
        serviceId,
        date: formattedDate,
      }
    }).then(res => {
      if (res.data.success) {
        setSlots(res.data.data || []);
      }
    }).finally(() => {
      setLoadingSlots(false);
    });
    setSelectedSlot(null);
  }, [selectedDate, serviceId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !appointmentId) {
      toast.error('Vui lòng chọn khung giờ khám mới');
      return;
    }

    let phoneToUse = verifiedPhone;
    if (!phoneToUse) {
      const phoneInput = window.prompt('Vui lòng nhập số điện thoại đặt lịch để xác nhận dời lịch:');
      if (!phoneInput) return;
      phoneToUse = phoneInput;
    }

    setIsSubmitting(true);
    try {
      // The API currently accepts newDate and newTime, let's extract them from startAt
      const newDateStr = format(parseISO(selectedSlot.startAt), 'yyyy-MM-dd');
      const newTimeStr = format(parseISO(selectedSlot.startAt), 'HH:mm');
      
      const res = await api.patch(`/public/appointments/${appointmentId}/reschedule`, {
        phone: phoneToUse,
        newDate: newDateStr,
        newTime: newTimeStr,
        newEndAt: selectedSlot.endAt
      });
      
      if (res.data.success) {
        toast.success("Dời lịch thành công, đang chờ phòng khám xác nhận lại");
        onSuccess(appointmentId, selectedSlot.startAt, selectedSlot.endAt);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Không thể dời lịch, vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-500" />
            Chọn lịch khám mới
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto min-h-0">
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {nextDays.map(date => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                const dayOfWeek = format(date, 'EEEE', { locale: vi });
                let shortDay = dayOfWeek.replace('thứ ', 'T').toUpperCase();
                if (dayOfWeek === 'chủ nhật') shortDay = 'CN';

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`shrink-0 w-[4.5rem] py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected 
                        ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500' 
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase">{shortDay}</span>
                    <span className={`text-lg font-bold ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>
                      {format(date, 'dd/MM')}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              {loadingSlots ? (
                <div className="py-8 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  Đang tải lịch trống...
                </div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.filter(s => s.isAvailable).map(slot => {
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-1 rounded-xl text-[13px] font-medium transition-all border ${
                          isSelected 
                            ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500' 
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {format(parseISO(slot.startAt), 'HH:mm')}
                      </button>
                    );
                  })}
                  {slots.filter(s => s.isAvailable).length === 0 && (
                    <div className="col-span-full py-6 text-center text-[13px] text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                      Hết lịch trống trong ngày này
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-[13px] text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  Không có lịch trống
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0">
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedSlot} 
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận dời lịch'}
          </button>
        </div>
      </div>
    </div>
  );
}
