import React, { useMemo, useState } from 'react';
import {
  Star,
  X,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  HeartHandshake,
  ShieldCheck,
  ThumbsUp,
  Phone,
} from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface ServiceItemBrief {
  id: string;
  name: string;
}

interface AppointmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  appointment: {
    id: string;
    clinicName?: string | null;
    patientName?: string;
    serviceId?: string | null;
    serviceIds?: string[] | null;
    serviceItems?: ServiceItemBrief[] | null;
    serviceRatings?: Record<string, number> | null;
    serviceName?: string;
    providerName?: string;
    startAt?: string;
    rating?: number | null;
    reviewComment?: string | null;
    reviewTags?: string[] | null;
  } | null;
  isStaffMode?: boolean;
  phone?: string;
  bookingCode?: string;
  onSuccess: (data?: any) => void;
  onCompleteWithoutReview?: () => void;
}

const REVIEW_TAGS = [
  '🦷 Bác sĩ tận tâm & êm ái',
  '✨ Cơ sở khang trang, sạch sẽ',
  '⏰ Đúng giờ hẹn, không phải chờ',
  '💬 Bác sĩ tư vấn rất kỹ',
  '💵 Chi phí minh bạch, hợp lý',
  '🛡️ Vô trùng an toàn chuẩn y khoa',
  '👩‍⚕️ Tiếp đón thân thiện, chu đáo',
];

const RATING_DESCRIPTIONS: Record<number, { title: string; subtitle: string; color: string }> = {
  5: { title: 'Tuyệt vời! Rất hài lòng', subtitle: 'Dịch vụ xuất sắc, hoàn toàn tin tưởng nha khoa', color: 'text-amber-500' },
  4: { title: 'Hài lòng, dịch vụ tốt', subtitle: 'Trải nghiệm khám thoải mái, an tâm', color: 'text-emerald-500' },
  3: { title: 'Tương đối hài lòng', subtitle: 'Dịch vụ ở mức chấp nhận được', color: 'text-blue-500' },
  2: { title: 'Chưa thực sự hài lòng', subtitle: 'Phòng khám cần cải thiện thêm một số khâu', color: 'text-orange-500' },
  1: { title: 'Cần cải thiện nhiều', subtitle: 'Trải nghiệm chưa đạt kỳ vọng của bệnh nhân', color: 'text-rose-500' },
};

function resolveRegisteredServices(
  appointment: AppointmentReviewModalProps['appointment']
): ServiceItemBrief[] {
  if (!appointment) return [];
  if (Array.isArray(appointment.serviceItems) && appointment.serviceItems.length > 0) {
    return appointment.serviceItems.filter((item) => item?.id);
  }
  const idList: string[] =
    Array.isArray(appointment.serviceIds) && appointment.serviceIds.length > 0
      ? appointment.serviceIds.filter(Boolean)
      : appointment.serviceId
        ? [appointment.serviceId]
        : [];
  if (idList.length === 0) return [];

  const splitNames = (appointment.serviceName || '')
    .split(/\s+\+\s+|,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  return idList.map((id, idx) => ({
    id,
    name:
      idList.length === 1
        ? appointment.serviceName || 'Dịch vụ nha khoa'
        : splitNames[idx] || `Dịch vụ #${idx + 1}`,
  }));
}

export default function AppointmentReviewModal({
  isOpen,
  onClose,
  onDismiss,
  appointment,
  isStaffMode = false,
  phone,
  bookingCode,
  onSuccess,
  onCompleteWithoutReview,
}: AppointmentReviewModalProps) {
  const registeredServices = useMemo(
    () => resolveRegisteredServices(appointment),
    [appointment]
  );

  const [rating, setRating] = useState<number>(appointment?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [serviceRatingsMap, setServiceRatingsMap] = useState<Record<string, number>>({});
  const [comment, setComment] = useState<string>(appointment?.reviewComment || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    Array.isArray(appointment?.reviewTags) ? appointment.reviewTags : []
  );
  const [manualPhone, setManualPhone] = useState<string>(phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  React.useEffect(() => {
    if (!appointment) return;
    const baseRating = Number(appointment.rating) || 5;
    setRating(baseRating);
    setComment(appointment.reviewComment || '');
    setSelectedTags(Array.isArray(appointment.reviewTags) ? appointment.reviewTags : []);
    setManualPhone(phone || '');
    setSubmittedSuccess(false);

    const initialMap: Record<string, number> = {};
    for (const svc of registeredServices) {
      const existingSvcRating = appointment.serviceRatings?.[svc.id];
      initialMap[svc.id] =
        existingSvcRating && Number(existingSvcRating) >= 1 && Number(existingSvcRating) <= 5
          ? Math.round(Number(existingSvcRating))
          : Math.min(5, Math.max(1, Math.round(baseRating)));
    }
    setServiceRatingsMap(initialMap);
  }, [appointment, registeredServices, phone]);

  if (!isOpen || !appointment) return null;

  const isMultiService = registeredServices.length > 1;

  const handleOverallStarSelect = (star: number) => {
    setRating(star);
    if (registeredServices.length > 0) {
      const synced: Record<string, number> = {};
      for (const svc of registeredServices) {
        synced[svc.id] = star;
      }
      setServiceRatingsMap(synced);
    }
  };

  const handlePerServiceStarSelect = (serviceId: string, star: number) => {
    const nextMap: Record<string, number> = {
      ...serviceRatingsMap,
      [serviceId]: star,
    };
    setServiceRatingsMap(nextMap);

    const values = registeredServices
      .map((s) => nextMap[s.id])
      .filter((v) => typeof v === 'number' && v >= 1 && v <= 5);
    if (values.length > 0) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      setRating(Number(avg.toFixed(1)));
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const effectivePhone = (phone || manualPhone || '').trim();
  const effectiveBookingCode = (bookingCode || '').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Vui lòng chọn số sao đánh giá (1-5 sao)');
      return;
    }
    if (!isStaffMode && !effectivePhone && !effectiveBookingCode) {
      toast.error('Vui lòng nhập số điện thoại đã đặt lịch để xác thực đánh giá');
      return;
    }

    const finalServiceRatings: Record<string, number> = {};
    for (const svc of registeredServices) {
      const val = serviceRatingsMap[svc.id] || Math.min(5, Math.max(1, Math.round(rating)));
      finalServiceRatings[svc.id] = Math.min(5, Math.max(1, Math.round(val)));
    }
    const perSvcVals = Object.values(finalServiceRatings);
    const computedOverall =
      perSvcVals.length > 0
        ? Number((perSvcVals.reduce((s, v) => s + v, 0) / perSvcVals.length).toFixed(1))
        : rating;

    setSubmitting(true);
    try {
      if (isStaffMode) {
        const res = await api.patch(`/appointments/${appointment.id}/status`, {
          status: 'COMPLETED',
          rating: computedOverall,
          serviceRatings: finalServiceRatings,
          reviewComment: comment,
          reviewTags: selectedTags,
        });
        setSubmittedSuccess(true);
        toast.success('Đã xác nhận hoàn tất ca khám và lưu đánh giá thành công!', { icon: '⭐' });
        setTimeout(() => {
          onSuccess(res.data?.data);
          onClose();
        }, 1200);
      } else {
        const res = await api.post(`/public/appointments/${appointment.id}/review`, {
          rating: computedOverall,
          serviceRatings: finalServiceRatings,
          reviewComment: comment,
          reviewTags: selectedTags,
          phone: effectivePhone || undefined,
          bookingCode: effectiveBookingCode || undefined,
        });
        setSubmittedSuccess(true);
        toast.success(res.data?.message || 'Cảm ơn bạn đã đánh giá dịch vụ!', { icon: '🌟' });
        setTimeout(() => {
          onSuccess(res.data?.data);
          onClose();
        }, 1400);
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      toast.error(err.response?.data?.error?.message || 'Không thể lưu đánh giá. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipReview = () => {
    if (onCompleteWithoutReview) {
      onCompleteWithoutReview();
      onClose();
    } else {
      onClose();
    }
  };

  const activeRating = hoverRating || Math.round(rating);
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transition-all my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-teal-600 via-emerald-600 to-teal-700 p-6 text-white text-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onDismiss) onDismiss();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-amber-300 shadow-inner mb-2.5 border border-white/20">
            <Sparkles className="w-6 h-6 drop-shadow" />
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            {isStaffMode ? 'Xác nhận hoàn tất & Đánh giá ca khám' : 'Cảm ơn bạn đã hoàn tất khám!'}
          </h3>

          <p className="text-xs sm:text-sm text-teal-50 mt-1 max-w-sm mx-auto leading-relaxed">
            {isStaffMode
              ? 'Ghi nhận điểm sao và nhận xét thực tế cho từng dịch vụ trong đợt đăng ký'
              : appointment.clinicName
                ? `Hãy chấm sao trải nghiệm dịch vụ tại ${appointment.clinicName} để giúp phòng khám phục vụ tốt hơn`
                : 'Điểm sao của bạn được gửi trực tiếp về phòng khám theo từng dịch vụ bạn đã sử dụng'}
          </p>

          <div className="mt-3.5 p-2.5 rounded-xl bg-black/15 backdrop-blur-md border border-white/10 flex items-center justify-center gap-3 text-xs font-medium text-white/95">
            <span className="flex items-center gap-1.5 truncate">
              <Stethoscope className="w-3.5 h-3.5 text-teal-200 shrink-0" />
              <strong className="text-white truncate">{appointment.serviceName || 'Dịch vụ nha khoa'}</strong>
            </span>
            {appointment.patientName && (
              <span className="border-l border-white/20 pl-3 truncate shrink-0">
                KH: <strong>{appointment.patientName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {submittedSuccess ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Cảm ơn bạn rất nhiều!</h4>
              <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Đánh giá của bạn đã được lưu và tổng hợp vào hệ thống đánh giá dịch vụ của phòng khám.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {rating}/5 Sao · {ratingInfo.title}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              {/* Overall Star Selector */}
              <div className="text-center space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  {isMultiService ? 'Đánh giá chung đợt khám' : 'Mức độ hài lòng của bạn'}
                </label>

                <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= activeRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleOverallStarSelect(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 sm:p-1.5 rounded-xl hover:bg-amber-50 transition-transform hover:scale-110 active:scale-95 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors duration-150 ${
                            isFilled
                              ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                              : 'text-slate-300 hover:text-amber-200'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-[40px] flex flex-col items-center justify-center">
                  <span className={`text-sm sm:text-base font-bold transition-colors ${ratingInfo.color} tabular-nums`}>
                    {rating}/5 · {ratingInfo.title}
                  </span>
                  <span className="text-xs text-slate-500">{ratingInfo.subtitle}</span>
                </div>
              </div>

              {/* Per-service star breakdown when booking has multiple services */}
              {isMultiService && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Đánh giá chi tiết từng dịch vụ trong đợt đăng ký này
                    </span>
                    <span className="text-[11px] text-teal-700 font-semibold tabular-nums">
                      {registeredServices.length} dịch vụ
                    </span>
                  </div>

                  <div className="space-y-2">
                    {registeredServices.map((svc) => {
                      const svcStars = serviceRatingsMap[svc.id] || Math.round(rating) || 5;
                      return (
                        <div
                          key={svc.id}
                          className="bg-white rounded-xl border border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="text-xs font-semibold text-slate-800 truncate flex-1">
                            {svc.name}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handlePerServiceStarSelect(svc.id, s)}
                                className="p-0.5 rounded hover:bg-amber-50 cursor-pointer"
                                title={`Chấm ${s} sao cho ${svc.name}`}
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    s <= svcStars
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-200 hover:text-amber-200'
                                  }`}
                                />
                              </button>
                            ))}
                            <span className="ml-1.5 text-xs font-bold text-slate-700 tabular-nums w-6 text-right">
                              {svcStars}★
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phone verification fallback in public mode only when neither phone nor device bookingCode is present */}
              {!isStaffMode && !phone && !effectiveBookingCode && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    Số điện thoại đã đặt lịch *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="Nhập SĐT đã dùng để đặt lịch hẹn này..."
                    className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
              )}

              {/* Quick Feedback Tags */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ThumbsUp className="w-3.5 h-3.5 text-teal-600" />
                  Điểm nổi bật bạn ấn tượng nhất:
                </label>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Nhận xét chi tiết (không bắt buộc)</span>
                  <span className="text-[11px] text-slate-400 font-normal tabular-nums">
                    {comment.length}/300 ký tự
                  </span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder={
                    isStaffMode
                      ? 'Ghi lại lời khen hoặc góp ý của bệnh nhân khi hoàn tất ca khám...'
                      : 'Bác sĩ làm có êm không, dịch vụ có hài lòng không? Chia sẻ thêm trải nghiệm của bạn...'
                  }
                  className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Trust note */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Đồng bộ trực tiếp lên hệ thống dịch vụ:</strong> Số sao bạn chấm sẽ được cập nhật vào điểm đánh giá của từng dịch vụ đã chọn và quản lý công khai minh bạch.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                {isStaffMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSkipReview}
                      disabled={submitting}
                      className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                    >
                      Chỉ hoàn thành (Bỏ qua đánh giá)
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                      {submitting ? 'Đang lưu...' : `Hoàn tất & Lưu đánh giá (${rating} ⭐)`}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (onDismiss) onDismiss();
                        onClose();
                      }}
                      disabled={submitting}
                      className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                    >
                      Để sau
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      {submitting ? 'Đang gửi...' : `Gửi đánh giá (${rating} ⭐)`}
                    </button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
