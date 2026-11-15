import React, { useEffect, useState } from 'react';
import {
  Star,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  MessageSquareHeart,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useBookingStore } from '../store/booking';
import { getActiveRouteClinicSlug } from '../services/clinicResolver';

interface ReviewItem {
  id: string;
  rating: number | null;
  comment: string;
  tags: string[];
  serviceName: string;
  providerName: string;
  patientName: string;
  date: string;
  verified: boolean;
  hideRating?: boolean;
  isRatingHidden?: boolean;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratedCount: number;
  visibleReviewsCount: number;
  satisfactionRate: string;
  ratingDistribution: Record<number, number>;
}

export default function ClinicReputationWidget({
  variant = 'compact',
  refreshKey = 0,
}: {
  variant?: 'compact' | 'full';
  refreshKey?: number;
}) {
  const { slug: paramSlug } = useParams();
  const storeSlug = useBookingStore((s) => s.clinicProfile?.slug);
  const tenantId = useBookingStore((s) => s.tenantId);

  const effectiveSlug = (
    paramSlug ||
    getActiveRouteClinicSlug() ||
    storeSlug ||
    ''
  )
    .trim()
    .toLowerCase();

  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReviewIdx] = useState(0);

  useEffect(() => {
    setLoading(true);
    api
      .get('/public/reviews', {
        params: {
          ...(effectiveSlug ? { slug: effectiveSlug } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
      })
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setStats(res.data.data.stats);
          setReviews(res.data.data.reviews || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [effectiveSlug, tenantId, refreshKey]);

  if (loading && !stats) return null;

  const ratedCount = Number(stats?.ratedCount ?? 0);
  const avgRating = Number(stats?.averageRating ?? 0);
  const hasVisibleReviews = reviews.length > 0;
  const hasAnyData = ratedCount > 0 || hasVisibleReviews;
  const currentReview = hasVisibleReviews ? reviews[activeReviewIdx % reviews.length] : null;

  if (variant === 'compact') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-emerald-500/10 border border-amber-200/60 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0 tabular-nums">
              {ratedCount > 0 ? `${avgRating.toFixed(1)}★` : '★'}
            </div>
            <div>
              {hasAnyData ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ratedCount > 0 ? (
                      <>
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= Math.round(avgRating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-800 tabular-nums">
                          {avgRating.toFixed(1)}/5.0 Độ uy tín
                        </span>
                        {stats?.satisfactionRate && stats.satisfactionRate !== 'Chưa có đánh giá' && (
                          <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold tabular-nums">
                            {stats.satisfactionRate} Hài lòng
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-800">
                        Phản hồi thực tế từ khách hàng ({reviews.length})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {ratedCount > 0
                      ? `Tổng hợp từ ${ratedCount} lượt đánh giá xác thực sau khi hoàn tất khám.`
                      : 'Điểm sao chi tiết đang được phòng khám quản lý hiển thị.'}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-slate-800 block">
                    Đánh giá dịch vụ xác thực sau khám
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chưa có đánh giá công khai — Điểm sao thực tế được tổng hợp sau khi khách hàng hoàn tất khám.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-teal-800 font-semibold bg-white/80 border border-teal-200 px-3 py-1.5 rounded-xl shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            100% Khách hàng thật
          </div>
        </div>

        {currentReview && currentReview.comment && (
          <div className="mt-3 pt-3 border-t border-amber-200/40 text-xs text-slate-600 flex items-start gap-2">
            <MessageSquareHeart className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-slate-700">{currentReview.patientName}: </span>
              <span className="italic">"{currentReview.comment}"</span>
              <span className="text-[11px] text-teal-700 ml-1.5 font-medium">
                ({currentReview.serviceName})
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="my-8 rounded-3xl bg-white border border-slate-200/80 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Uy tín &amp; Đánh giá từ bệnh nhân
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Chất lượng điều trị được khẳng định qua từng nụ cười
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Đánh giá bằng sao thực tế được thu thập ngay sau khi ca khám được xác nhận hoàn thành
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shrink-0">
          <div className="text-center pr-4 border-r border-slate-200">
            <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {ratedCount > 0 ? avgRating.toFixed(1) : '—'}
            </div>
            <div className="flex text-amber-400 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    ratedCount > 0 && s <= Math.round(avgRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-bold text-emerald-700 flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {ratedCount > 0
                ? `${stats?.satisfactionRate || '0%'} Bệnh nhân hài lòng`
                : 'Chưa có đánh giá'}
            </div>
            <div className="text-slate-500 tabular-nums">
              {ratedCount > 0
                ? `${ratedCount} lượt đánh giá xác thực`
                : 'Đang chờ đánh giá từ khách hàng'}
            </div>
            <div className="text-teal-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Chuẩn y tế vô trùng
            </div>
          </div>
        </div>
      </div>

      {hasVisibleReviews ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {reviews.slice(0, 3).map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  {r.rating && !r.hideRating && !r.isRatingHidden ? (
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= Math.round(r.rating || 0)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-purple-600" />
                      Phản hồi từ bệnh nhân
                    </span>
                  )}
                  <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                    ✓ Đã khám
                  </span>
                </div>
                {r.comment ? (
                  <p className="text-xs text-slate-700 leading-relaxed italic mb-3">
                    "{r.comment}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic mb-3">
                    Đã gửi đánh giá mức độ hài lòng cho dịch vụ.
                  </p>
                )}
                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {r.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-800">{r.patientName}</span>
                <span className="text-slate-400 truncate max-w-[140px]">{r.serviceName}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
          Chưa có nhận xét công khai nào — Điểm sao và nhận xét thực tế được tổng hợp sau khi khách hàng hoàn tất buổi khám.
        </div>
      )}
    </section>
  );
}
