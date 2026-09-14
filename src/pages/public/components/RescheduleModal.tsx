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
  const [phoneFallback, setPhoneFallback] = useState('');

  useEffect(() => {
    if (verifiedPhone) {
      setPhoneFallback(verifiedPhone);
    }
  }, [verifiedPhone]);

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

    const phoneToUse = verifiedPhone || phoneFallback.trim();
    if (!phoneToUse) {
      toast.error('Vui lòng nhập số điện thoại để xác nhận dời lịch');
      return;
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
                        className={`min-h-[44px] py-2 px-1 rounded-xl text-sm font-bold transition-all border flex items-center justify-center cursor-pointer ${
                          isSelected 
                            ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600/30' 
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
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

            {/* Mobile-friendly phone confirmation if verifiedPhone is missing */}
            {!verifiedPhone && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Số điện thoại xác nhận <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Nhập số điện thoại đã đặt lịch..."
                  value={phoneFallback}
                  onChange={(e) => setPhoneFallback(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedSlot} 
            className="w-full min-h-[48px] py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận dời sang lịch này'}
          </button>
        </div>
      </div>
    </div>
  );
}
