import React, { useEffect, useState } from 'react';
import {
  Star,
  X,
  MessageSquareText,
  Calendar,
  UserCheck,
  ShieldCheck,
  EyeOff,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';

interface ServiceReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    id: string;
    name: string;
    showRating?: boolean;
    showReviews?: boolean;
    ratingStats?: {
      averageRating?: number | null;
      ratedCount?: number;
      visibleReviewsCount?: number;
      showRating?: boolean;
      showReviews?: boolean;
      ratingDistribution?: Record<number, number>;
    };
  } | null;
  clinicSlug?: string;
  tenantId?: string | null;
}

interface ServiceReviewEntry {
  id: string;
  rating: number | null;
  isRatingHidden?: boolean;
  hideRating?: boolean;
  comment: string;
  tags: string[];
  serviceName?: string;
  providerName?: string;
  patientName: string;
  date: string;
  verified?: boolean;
}

export default function ServiceReviewsModal({
  isOpen,
  onClose,
  service,
  clinicSlug,
  tenantId,
}: ServiceReviewsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [reviews, setReviews] = useState<ServiceReviewEntry[]>([]);

  useEffect(() => {
    if (!isOpen || !service?.id) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    setLoading(true);
    setError(null);
    api
      .get('/public/reviews', {
        params: {
          serviceId: service.id,
          ...(clinicSlug ? { slug: clinicSlug } : {}),
          ...(tenantId ? { tenantId } : {}),
          limit: 30,
        },
      })
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setStats(res.data.data.stats || null);
          setReviews(Array.isArray(res.data.data.reviews) ? res.data.data.reviews : []);
        } else {
          setError('Không thể tải dữ liệu đánh giá của dịch vụ.');
        }
      })
      .catch(() => {
        setError('Không thể tải nhận xét lúc này. Vui lòng thử lại sau.');
      })
      .finally(() => setLoading(false));

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, service?.id, clinicSlug, tenantId, onClose]);

  if (!isOpen || !service) return null;

  const showRating =
    stats?.showRating !== undefined
      ? Boolean(stats.showRating)
      : service.showRating !== false;
  const showReviews =
    stats?.showReviews !== undefined
      ? Boolean(stats.showReviews)
      : service.showReviews !== false;

  const ratedCount = Number(stats?.ratedCount ?? service.ratingStats?.ratedCount ?? 0);
  const avgRating = Number(stats?.averageRating ?? service.ratingStats?.averageRating ?? 0);
  const distribution: Record<number, number> =
    stats?.ratingDistribution ||
    service.ratingStats?.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-reviews-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[88vh] rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 mb-1">
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span>Đánh giá thực tế từ khách hàng đã khám</span>
            </div>
            <h3
              id="service-reviews-modal-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 truncate"
            >
              {service.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ đánh giá"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span>Đang tải nhận xét khách hàng...</span>
            </div>
          ) : error ? (
            <div className="py-10 px-4 text-center bg-white rounded-2xl border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          ) : (
            <>
              {/* Earned Star Summary */}
              {showRating ? (
                ratedCount > 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-5">
                    <div className="flex sm:flex-col items-center justify-between sm:justify-center sm:pr-6 sm:border-r border-slate-100 shrink-0 gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums">
                          {avgRating.toFixed(1)}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">/5</span>
                      </div>
                      <div className="flex flex-col items-end sm:items-center gap-1">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                s <= Math.round(avgRating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {ratedCount} lượt chấm sao
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = Number(distribution[star] || 0);
                        const pct = ratedCount > 0 ? Math.round((count / ratedCount) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-8 font-semibold text-slate-700 tabular-nums flex items-center gap-0.5">
                              {star}
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            </span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-slate-500 tabular-nums font-mono">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex items-center gap-2.5">
                    <Star className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Dịch vụ này chưa có lượt chấm sao công khai nào. Điểm sao thực tế được tổng hợp sau khi khách hàng hoàn tất buổi khám.
                    </span>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex items-center gap-2.5">
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Phòng khám đang tạm ẩn hiển thị điểm sao cho dịch vụ này.</span>
                </div>
              )}

              {/* Reviews Feed */}
              {!showReviews ? (
                <div className="py-8 px-4 text-center bg-white rounded-2xl border border-slate-200 space-y-1.5">
                  <EyeOff className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">
                    Danh sách nhận xét đang được phòng khám tạm ẩn
                  </p>
                  <p className="text-xs text-slate-500">
                    Quản trị viên phòng khám hiện chưa bật hiển thị nhận xét chi tiết cho dịch vụ này.
                  </p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="py-10 px-4 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                  <MessageSquareText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">
                    Chưa có nhận xét công khai nào
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Nhận xét xác thực sẽ xuất hiện tại đây sau khi khách hàng hoàn thành ca khám và gửi đánh giá.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span className="font-semibold text-slate-700">
                      Nhận xét xác thực ({reviews.length})
                    </span>
                    <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Đã hoàn tất khám tại phòng khám
                    </span>
                  </div>

                  {reviews.map((r) => {
                    const parsedDate = r.date ? new Date(r.date) : null;
                    const validDate = parsedDate && !isNaN(parsedDate.getTime());
                    const showEntryStars =
                      r.rating !== null &&
                      r.rating !== undefined &&
                      !r.isRatingHidden &&
                      !r.hideRating;

                    return (
                      <div
                        key={r.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-900">{r.patientName}</span>
                            {r.providerName && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="inline-flex items-center gap-1 text-slate-600">
                                  <UserCheck className="w-3 h-3 text-teal-600 shrink-0" />
                                  {r.providerName}
                                </span>
                              </>
                            )}
                          </div>

                          {validDate && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono tabular-nums">
                              <Calendar className="w-3 h-3" />
                              {format(parsedDate, 'dd/MM/yyyy')}
                            </span>
                          )}
                        </div>

                        {showEntryStars ? (
                          <div className="flex items-center gap-2">
                            <div className="flex text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= Math.round(Number(r.rating || 0))
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-800 tabular-nums">
                              {r.rating}/5
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] font-medium text-slate-500">
                            Phản hồi từ khách hàng đã khám
                          </div>
                        )}

                        {r.tags && r.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {r.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[11px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {r.comment ? (
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Khách hàng đã gửi đánh giá nhanh bằng sao &amp; tiêu chí hài lòng.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
