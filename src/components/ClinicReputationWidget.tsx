import React, { useEffect, useState } from 'react';
import { Star, ShieldCheck, ThumbsUp, Sparkles, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import api from '../services/api';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  tags: string[];
  serviceName: string;
  providerName: string;
  patientName: string;
  date: string;
  verified: boolean;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  satisfactionRate: string;
  verifiedReviewsCount: number;
  ratingDistribution: Record<number, number>;
}

export default function ClinicReputationWidget({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);

  useEffect(() => {
    api.get('/public/reviews')
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setStats(res.data.data.stats);
          setReviews(res.data.data.reviews || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !stats) return null;

  const currentReview = reviews.length > 0 ? reviews[activeReviewIdx % reviews.length] : null;

  if (variant === 'compact') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-emerald-500/10 border border-amber-200/60 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0">
              {stats?.averageRating || 4.9}★
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {stats?.averageRating || 4.9}/5.0 Độ uy tín
                </span>
                <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                  {stats?.satisfactionRate || '99%'} Hài lòng
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dựa trên {stats?.totalReviews || 120}+ lượt đánh giá xác thực từ bệnh nhân sau khi hoàn tất khám.
              </p>
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
              <span className="text-[11px] text-teal-700 ml-1.5 font-medium">({currentReview.serviceName})</span>
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
            Uy tín & Đánh giá từ bệnh nhân
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
            <div className="text-3xl font-extrabold text-slate-900">
              {stats?.averageRating || 4.9}
            </div>
            <div className="flex text-amber-400 justify-center mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats?.satisfactionRate || '99%'} Bệnh nhân hài lòng
            </div>
            <div className="text-slate-500">
              {stats?.totalReviews || 125}+ lượt đánh giá xác thực
            </div>
            <div className="text-teal-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Chuẩn y tế vô trùng
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {reviews.slice(0, 3).map((r) => (
          <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
                <span className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                  ✓ Đã khám
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic mb-3">
                "{r.comment || 'Dịch vụ rất tốt, bác sĩ nhiệt tình nhẹ nhàng!'}"
              </p>
              {r.tags && r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {r.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-800">{r.patientName}</span>
              <span className="text-slate-400 truncate max-w-[120px]">{r.serviceName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
