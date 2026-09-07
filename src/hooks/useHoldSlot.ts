import { useState, useCallback } from 'react';
import { useBookingStore } from '../store/booking';
import api from '../services/api';
import toast from 'react-hot-toast';

export interface Slot {
  providerId: string;
  startAt: string;
  endAt: string;
  isAvailable?: boolean;
  unavailableReason?: string;
  isMyHeld?: boolean;
}

export function useHoldSlot() {
  const {
    serviceId,
    sessionToken,
    slotStartTime,
    slotEndTime,
    holdExpiresAt,
    setDateTimeSlot,
    clearHold
  } = useBookingStore();

  const [holdingSlotStart, setHoldingSlotStart] = useState<string | null>(null);

  // Kiểm tra xem slot này có đang được chính client giữ chỗ còn hiệu lực không
  const isHeldByMe = useCallback((startAt: string, endAt?: string) => {
    if (!sessionToken || !holdExpiresAt || !slotStartTime) return false;
    // Kiểm tra thời hạn giữ chỗ (buffer 5s)
    const isValid = holdExpiresAt > Date.now() + 5000;
    if (!isValid) return false;
    const matchStart = slotStartTime === startAt;
    const matchEnd = !endAt || slotEndTime === endAt;
    return matchStart && matchEnd;
  }, [sessionToken, holdExpiresAt, slotStartTime, slotEndTime]);

  // Yêu cầu giữ chỗ hoặc tái sử dụng phiên đang giữ
  const holdSlot = useCallback(async (
    slot: { providerId: string; startAt: string; endAt: string },
    selectedDateStr: string,
    providerName?: string | null
  ): Promise<{ success: boolean; sessionToken?: string }> => {
    if (!serviceId) {
      toast.error('Vui lòng chọn dịch vụ trước');
      return { success: false };
    }

    // 1. TÁI SỬ DỤNG PHIÊN NẾU ĐANG GIỮ ĐÚNG KHUNG GIỜ NÀY VÀ CÒN HẠN (Tránh lỗi 409)
    if (isHeldByMe(slot.startAt, slot.endAt) && sessionToken && holdExpiresAt) {
      setDateTimeSlot(
        selectedDateStr,
        slot.providerId,
        sessionToken,
        slot.startAt,
        slot.endAt,
        holdExpiresAt,
        providerName
      );
      return { success: true, sessionToken };
    }

    // 2. NẾU LÀ SLOT MỚI HOẶC PHIÊN CŨ ĐÃ HẾT HẠN -> GỌI API GIỮ CHỖ
    setHoldingSlotStart(slot.startAt);
    try {
      const res = await api.post('/public/appointments/hold', {
        serviceId,
        providerId: slot.providerId,
        startAt: slot.startAt,
        endAt: slot.endAt
      });

      if (res.data?.success && res.data?.data?.sessionToken) {
        const token = res.data.data.sessionToken;
        const expiresAt = new Date(res.data.data.expiresAt).getTime();
        setDateTimeSlot(
          selectedDateStr,
          slot.providerId,
          token,
          slot.startAt,
          slot.endAt,
          expiresAt,
          providerName
        );
        return { success: true, sessionToken: token };
      } else {
        const msg = res.data?.message || 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.';
        toast.error(msg);
        return { success: false };
      }
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.response?.data?.message || 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.';
      toast.error(msg);
      return { success: false };
    } finally {
      setHoldingSlotStart(null);
    }
  }, [serviceId, sessionToken, holdExpiresAt, isHeldByMe, setDateTimeSlot]);

  return {
    isHeldByMe,
    holdSlot,
    holdingSlotStart,
    clearHold,
    activeSessionToken: sessionToken,
    activeSlotStartTime: slotStartTime,
    activeHoldExpiresAt: holdExpiresAt
  };
}
