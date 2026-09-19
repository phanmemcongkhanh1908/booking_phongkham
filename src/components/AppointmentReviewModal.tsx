import React, { useState } from 'react';
import { Star, X, CheckCircle2, Sparkles, Stethoscope, HeartHandshake, ShieldCheck, ThumbsUp } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface AppointmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    patientName?: string;
    serviceName?: string;
    providerName?: string;
    startAt?: string;
    rating?: number | null;
    reviewComment?: string | null;
    reviewTags?: string[] | null;
  } | null;
  isStaffMode?: boolean; // When called from Admin Dashboard
  phone?: string;        // For patient verification on public portal
  onSuccess: (data?: any) => void;
  onCompleteWithoutReview?: () => void; // Staff mode skip option
}

const REVIEW_TAGS = [
  '🦷 Bác sĩ tận tâm & êm ái',
  '✨ Cơ sở khang trang, sạch sẽ',
  '⏰ Đúng giờ hẹn, không phải chờ',
  '💬 Bác sĩ tư vấn rất kỹ',
  '💵 Chi phí minh bạch, hợp lý',
  '🛡️ Vô trùng an toàn chuẩn y khoa',
  '👩‍⚕️ Tiếp đón thân thiện, chu đáo'
];

const RATING_DESCRIPTIONS: Record<number, { title: string; subtitle: string; color: string }> = {
  5: { title: 'Tuyệt vời! Rất hài lòng', subtitle: 'Dịch vụ xuất sắc, hoàn toàn tin tưởng nha khoa', color: 'text-amber-500' },
  4: { title: 'Hài lòng, dịch vụ tốt', subtitle: 'Trải nghiệm khám thoải mái, an tâm', color: 'text-emerald-500' },
  3: { title: 'Tương đối hài lòng', subtitle: 'Dịch vụ ở mức chấp nhận được', color: 'text-blue-500' },
  2: { title: 'Chưa thực sự hài lòng', subtitle: 'Phòng khám cần cải thiện thêm một số khâu', color: 'text-orange-500' },
  1: { title: 'Cần cải thiện nhiều', subtitle: 'Trải nghiệm chưa đạt kỳ vọng của bệnh nhân', color: 'text-rose-500' },
};

export default function AppointmentReviewModal({
  isOpen,
  onClose,
  appointment,
  isStaffMode = false,
  phone,
  onSuccess,
  onCompleteWithoutReview
}: AppointmentReviewModalProps) {
  const [rating, setRating] = useState<number>(appointment?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(appointment?.reviewComment || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(appointment?.reviewTags || []);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Synchronize state when appointment changes
  React.useEffect(() => {
    if (appointment) {
      setRating(appointment.rating || 5);
      setComment(appointment.reviewComment || '');
      setSelectedTags(appointment.reviewTags || (appointment.rating ? [] : ['🦷 Bác sĩ tận tâm & êm ái', '✨ Cơ sở khang trang, sạch sẽ']));
      setSubmittedSuccess(false);
    }
  }, [appointment]);

  if (!isOpen || !appointment) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Vui lòng chọn số sao đánh giá (1-5 sao)');
      return;
    }

    setSubmitting(true);
    try {
      if (isStaffMode) {
        // Staff mode: update status to COMPLETED along with review
        const res = await api.patch(`/appointments/${appointment.id}/status`, {
          status: 'COMPLETED',
          rating,
          reviewComment: comment,
          reviewTags: selectedTags
        });
        setSubmittedSuccess(true);
        toast.success('Đã xác nhận hoàn tất ca khám và lưu đánh giá thành công!', { icon: '⭐' });
        setTimeout(() => {
          onSuccess(res.data?.data);
          onClose();
        }, 1200);
      } else {
        // Patient mode: public review endpoint
        const res = await api.post(`/public/appointments/${appointment.id}/review`, {
          rating,
          reviewComment: comment,
          reviewTags: selectedTags,
          phone
        });
        setSubmittedSuccess(true);
        toast.success(res.data?.message || 'Cảm ơn bạn đã đánh giá dịch vụ!', { icon: '🌟' });
        setTimeout(() => {
          onSuccess(res.data?.data);
          onClose();
        }, 1500);
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

  const activeRating = hoverRating || rating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transition-all my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header decoration */}
        <div className="relative bg-gradient-to-br from-teal-600 via-emerald-600 to-teal-700 p-6 text-white text-center">
          <button 
            type="button"
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md text-amber-300 shadow-inner mb-3 border border-white/20">
            <Sparkles className="w-8 h-8 drop-shadow animate-pulse" />
          </div>

          <h3 className="text-xl font-extrabold tracking-tight">
            {isStaffMode ? 'Xác nhận hoàn tất & Đánh giá ca khám' : 'Đánh giá trải nghiệm khám'}
          </h3>
          
          <p className="text-xs sm:text-sm text-teal-50 mt-1 max-w-sm mx-auto leading-relaxed">
            {isStaffMode 
              ? 'Ghi nhận phản hồi trực tiếp của bệnh nhân để nâng cao uy tín nha khoa'
              : 'Ý kiến chân thực của bạn là động lực quý báu để nha khoa phục vụ chu đáo hơn'}
          </p>

          {/* Appointment Snapshot */}
          <div className="mt-4 p-2.5 rounded-xl bg-black/15 backdrop-blur-md border border-white/10 flex items-center justify-center gap-4 text-xs font-medium text-white/95">
            <span className="flex items-center gap-1.5 truncate">
              <Stethoscope className="w-3.5 h-3.5 text-teal-200 shrink-0" />
              <strong className="text-white">{appointment.serviceName || 'Dịch vụ nha khoa'}</strong>
            </span>
            {appointment.patientName && (
              <span className="border-l border-white/20 pl-3 truncate">
                BN: <strong>{appointment.patientName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        {submittedSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-bold text-slate-800">Cảm ơn bạn rất nhiều!</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Đánh giá của bạn đã được ghi nhận thành công, góp phần xây dựng uy tín chất lượng chuẩn mực của nha khoa.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {rating}/5 Sao • {ratingInfo.title}
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Star Rating Interactive Selector */}
            <div className="text-center space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Mức độ hài lòng của bạn
              </label>

              <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= activeRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 sm:p-1.5 rounded-xl hover:bg-amber-50 transition-all transform hover:scale-115 active:scale-95 cursor-pointer focus:outline-none"
                    >
                      <Star
                        className={`w-9 h-9 sm:w-11 sm:h-11 transition-all duration-150 ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'text-slate-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Rating Description dynamic badge */}
              <div className="min-h-[44px] flex flex-col items-center justify-center">
                <span className={`text-sm sm:text-base font-bold transition-colors ${ratingInfo.color}`}>
                  {ratingInfo.title}
                </span>
                <span className="text-xs text-slate-500">
                  {ratingInfo.subtitle}
                </span>
              </div>
            </div>

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
                      className={`text-xs px-3 py-2 rounded-xl font-medium border transition-all cursor-pointer select-none ${
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

            {/* Review Comment Textarea */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Cảm nhận chi tiết (không bắt buộc)</span>
                <span className="text-[11px] text-slate-400 font-normal">{comment.length}/300 ký tự</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 300))}
                rows={3}
                placeholder={
                  isStaffMode
                    ? 'Ghi lại lời khen hoặc góp ý của bệnh nhân khi thanh toán tại quầy...'
                    : 'Bác sĩ làm có êm không, nhân viên phục vụ thế nào? Chia sẻ thêm trải nghiệm của bạn...'
                }
                className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Reputation trust note */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Góp phần nâng cao uy tín nha khoa:</strong> Đánh giá xác thực từ những ca khám thực tế sẽ được hiển thị trên hệ thống để giúp khách hàng mới thêm an tâm chọn dịch vụ.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
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
                    onClick={onClose}
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
  );
}
