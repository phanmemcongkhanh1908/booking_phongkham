import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  Filter,
  RotateCcw,
  MessageSquareHeart,
} from 'lucide-react';

export interface RatingBucketServiceStat {
  avgRating: number;
  reviewCount: number;
  satisfactionRate: number;
}

export interface RatingTrendDayPoint {
  date: string;
  avgRating: number | null;
  reviewCount: number;
  satisfactionRate: number | null;
  starBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  byService: Record<string, RatingBucketServiceStat>;
}

export interface RatingTrendWeekPoint {
  week: string;
  startDate: string;
  endDate: string;
  avgRating: number | null;
  reviewCount: number;
  satisfactionRate: number | null;
  starBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  byService: Record<string, RatingBucketServiceStat>;
}

export interface RatedServiceSummary {
  serviceId: string;
  serviceName: string;
  avgRating: number;
  reviewCount: number;
  satisfactionRate: number;
  fiveStarCount: number;
  lowRatingCount: number;
  latestRatedAt: string | null;
}

export interface RatingAnalyticsData {
  summary: {
    averageRating: number | null;
    totalReviews: number;
    satisfactionRate: number;
    fiveStarRate: number;
    lowRatingCount: number;
    hiddenRatingsCount: number;
    trendDelta: number | null;
    starDistribution: Array<{ star: 1 | 2 | 3 | 4 | 5; count: number; percent: number }>;
  };
  ratingTrendByDay: RatingTrendDayPoint[];
  ratingTrendByWeek: RatingTrendWeekPoint[];
  ratedServices: RatedServiceSummary[];
}

interface ServiceRatingTrendChartProps {
  ratingAnalytics?: RatingAnalyticsData;
  timeRange: '7' | '14' | '30' | 'all';
  onResetTimeRange?: () => void;
  isMobile?: boolean;
}

const COMPARE_COLORS = ['#0d9488', '#2563eb', '#d97706', '#7c3aed'];

const EMPTY_DATA: RatingAnalyticsData = {
  summary: {
    averageRating: null,
    totalReviews: 0,
    satisfactionRate: 0,
    fiveStarRate: 0,
    lowRatingCount: 0,
    hiddenRatingsCount: 0,
    trendDelta: null,
    starDistribution: [5, 4, 3, 2, 1].map((star) => ({
      star: star as 1 | 2 | 3 | 4 | 5,
      count: 0,
      percent: 0,
    })),
  },
  ratingTrendByDay: [],
  ratingTrendByWeek: [],
  ratedServices: [],
};

function formatDateTick(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM', { locale: vi });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: vi });
  } catch {
    return dateStr;
  }
}

function formatWeekLabel(weekStr: string): string {
  const parts = weekStr.split('-W');
  return parts[1] ? `Tuần ${parts[1]}` : weekStr;
}

export default function ServiceRatingTrendChart({
  ratingAnalytics,
  timeRange,
  onResetTimeRange,
  isMobile = false,
}: ServiceRatingTrendChartProps) {
  const analytics = ratingAnalytics || EMPTY_DATA;
  const [granularity, setGranularity] = useState<'day' | 'week'>('day');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [chartMode, setChartMode] = useState<'trend' | 'compare'>('trend');

  const ratedServices = analytics.ratedServices || [];
  const topCompareServices = useMemo(() => ratedServices.slice(0, 4), [ratedServices]);

  // If currently selected service disappears after changing time range, fall back to 'all'
  const effectiveServiceId = useMemo(() => {
    if (selectedServiceId === 'all') return 'all';
    return ratedServices.some((s) => s.serviceId === selectedServiceId)
      ? selectedServiceId
      : 'all';
  }, [selectedServiceId, ratedServices]);

  const selectedServiceMeta = useMemo(
    () => ratedServices.find((s) => s.serviceId === effectiveServiceId) || null,
    [ratedServices, effectiveServiceId]
  );

  // Build Recharts series according to granularity & selected service filter
  const chartData = useMemo(() => {
    const rawBuckets =
      granularity === 'day'
        ? analytics.ratingTrendByDay || []
        : analytics.ratingTrendByWeek || [];

    return rawBuckets.map((bucket) => {
      const isDay = 'date' in bucket;
      const label = isDay
        ? formatDateTick((bucket as RatingTrendDayPoint).date)
        : formatWeekLabel((bucket as RatingTrendWeekPoint).week);
      const fullLabel = isDay
        ? formatDateFull((bucket as RatingTrendDayPoint).date)
        : `${formatWeekLabel((bucket as RatingTrendWeekPoint).week)} (${formatDateTick((bucket as RatingTrendWeekPoint).startDate)} – ${formatDateTick((bucket as RatingTrendWeekPoint).endDate)})`;

      const svcStat =
        effectiveServiceId !== 'all' ? bucket.byService?.[effectiveServiceId] : undefined;

      const avgRating =
        effectiveServiceId === 'all'
          ? bucket.avgRating
          : svcStat
            ? svcStat.avgRating
            : null;
      const reviewCount =
        effectiveServiceId === 'all'
          ? bucket.reviewCount
          : svcStat
            ? svcStat.reviewCount
            : 0;
      const satisfactionRate =
        effectiveServiceId === 'all'
          ? bucket.satisfactionRate
          : svcStat
            ? svcStat.satisfactionRate
            : null;

      // Top service entries in this bucket for rich tooltip context
      const byServiceEntries = Object.entries(bucket.byService || {}) as Array<
        [string, RatingBucketServiceStat]
      >;
      const bucketServices = byServiceEntries
        .map(([sId, st]) => ({
          serviceId: sId,
          serviceName:
            ratedServices.find((rs) => rs.serviceId === sId)?.serviceName || 'Dịch vụ nha khoa',
          avgRating: st.avgRating,
          reviewCount: st.reviewCount,
        }))
        .sort((a, b) => b.reviewCount - a.reviewCount || b.avgRating - a.avgRating)
        .slice(0, 3);

      const row: Record<string, any> = {
        label,
        fullLabel,
        avgRating,
        reviewCount,
        satisfactionRate,
        starBreakdown: bucket.starBreakdown,
        bucketServices,
      };

      // Add per-service columns for Compare mode
      topCompareServices.forEach((svc) => {
        row[`svc_${svc.serviceId}`] = bucket.byService?.[svc.serviceId]?.avgRating ?? null;
      });

      return row;
    });
  }, [analytics, granularity, effectiveServiceId, ratedServices, topCompareServices]);

  const hasAnyPoints = chartData.some((d) => d.reviewCount > 0);
  const canCompareServices = effectiveServiceId === 'all' && topCompareServices.length >= 2;
  const activeMode = chartMode === 'compare' && canCompareServices ? 'compare' : 'trend';

  // Active headline metrics (either clinic-wide or filtered to selected service)
  const displayAvg =
    selectedServiceMeta !== null
      ? selectedServiceMeta.avgRating
      : analytics.summary.averageRating;
  const displayCount =
    selectedServiceMeta !== null
      ? selectedServiceMeta.reviewCount
      : analytics.summary.totalReviews;
  const displaySatisfaction =
    selectedServiceMeta !== null
      ? selectedServiceMeta.satisfactionRate
      : analytics.summary.satisfactionRate;
  const displayLowCount =
    selectedServiceMeta !== null
      ? selectedServiceMeta.lowRatingCount
      : analytics.summary.lowRatingCount;

  const delta = effectiveServiceId === 'all' ? analytics.summary.trendDelta : null;

  return (
    <Card className="shadow-xs border-slate-200/80 bg-white">
      {/* Header & Interactive Filters */}
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
            <span>Biểu đồ Đánh giá Mức độ Hài lòng theo Thời gian</span>
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi biến động điểm sao (1–5★) và lượng phản hồi thực tế của bệnh nhân
            {selectedServiceMeta ? ` • Đang lọc: ${selectedServiceMeta.serviceName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Service filter dropdown */}
          <div className="relative inline-flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              aria-label="Lọc theo dịch vụ"
              value={effectiveServiceId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedServiceId(nextId);
                if (nextId !== 'all') setChartMode('trend');
              }}
              className="pl-8 pr-7 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 max-w-[230px] truncate cursor-pointer"
            >
              <option value="all">Tất cả dịch vụ ({analytics.summary.totalReviews})</option>
              {ratedServices.map((svc) => (
                <option key={svc.serviceId} value={svc.serviceId}>
                  {svc.serviceName} — {svc.avgRating.toFixed(1)}★ ({svc.reviewCount})
                </option>
              ))}
            </select>
          </div>

          {/* Compare top services mode toggle */}
          {canCompareServices && (
            <button
              type="button"
              onClick={() => setChartMode(activeMode === 'compare' ? 'trend' : 'compare')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'compare'
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>So sánh dịch vụ</span>
            </button>
          )}

          {/* Day / Week segmented control */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setGranularity('day')}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                granularity === 'day'
                  ? 'bg-white text-teal-800 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo Ngày
            </button>
            <button
              type="button"
              onClick={() => setGranularity('week')}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                granularity === 'week'
                  ? 'bg-white text-teal-800 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo Tuần
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* KPI Strip - single elevation, clean hairline dividers, tabular-nums */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
          <div className="px-4 py-3.5 sm:px-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Điểm Trung Bình
            </span>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
                {displayAvg !== null ? displayAvg.toFixed(1) : '—'}
                <span className="text-xs font-semibold text-slate-400 ml-0.5">/ 5.0</span>
              </span>
              {delta !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${
                    delta > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : delta < 0
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {delta > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : delta < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}★
                </span>
              )}
            </div>
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tổng Lượt Đánh Giá
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
                {displayCount}
              </span>
              <span className="text-xs text-slate-500">lượt phản hồi</span>
            </div>
            {effectiveServiceId === 'all' && analytics.summary.hiddenRatingsCount > 0 && (
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                Gồm {analytics.summary.hiddenRatingsCount} lượt đang ẩn công khai
              </p>
            )}
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tỷ Lệ Hài Lòng (≥4★)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-extrabold text-teal-700 tabular-nums">
                {displayCount > 0 ? `${displaySatisfaction}%` : '—'}
              </span>
              {effectiveServiceId === 'all' && displayCount > 0 && (
                <span className="text-[11px] text-slate-500 tabular-nums">
                  5★: {analytics.summary.fiveStarRate}%
                </span>
              )}
            </div>
          </div>

          <div className="px-4 py-3.5 sm:px-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Cần Lưu Ý (≤3★)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-xl sm:text-2xl font-extrabold tabular-nums ${
                  displayLowCount > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {displayLowCount}
              </span>
              <span className="text-xs text-slate-500">
                {displayLowCount > 0 ? 'ca cần xem lại' : 'ca điểm thấp'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Recharts Area */}
        <div className="p-4 sm:p-6">
          {hasAnyPoints ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                <div className="flex flex-wrap items-center gap-4">
                  {activeMode === 'trend' ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <span className="w-3 h-0.5 bg-amber-600 rounded-full"></span>
                        Điểm đánh giá TB (1–5★)
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-xs bg-slate-300"></span>
                        Số lượt đánh giá
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-teal-700">
                        <span className="w-3 border-t border-dashed border-teal-600"></span>
                        Mục tiêu 4.0★
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600 font-medium">
                      So sánh điểm đánh giá trung bình của top {topCompareServices.length} dịch vụ theo thời gian
                    </span>
                  )}
                </div>
                {effectiveServiceId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedServiceId('all')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Xem tất cả dịch vụ
                  </button>
                )}
              </div>

              <div className="h-[260px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {activeMode === 'trend' ? (
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 14, right: isMobile ? 0 : 12, left: isMobile ? -20 : -8, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="amberRatingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="rating"
                        domain={[1, 5.2]}
                        ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v) => `${v}★`}
                        tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="count"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={isMobile ? 28 : 36}
                      />
                      <ReferenceLine
                        yAxisId="rating"
                        y={4}
                        stroke="#0d9488"
                        strokeDasharray="4 4"
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const row = payload[0]?.payload;
                          if (!row) return null;
                          return (
                            <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[190px]">
                              <p className="text-slate-300 font-medium border-b border-slate-800 pb-1">
                                {row.fullLabel}
                              </p>
                              {row.reviewCount > 0 ? (
                                <>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-300">Điểm trung bình:</span>
                                    <span className="font-bold text-amber-400 tabular-nums">
                                      {Number(row.avgRating).toFixed(2)} / 5.0 ★
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-300">Số lượt đánh giá:</span>
                                    <span className="font-semibold text-white tabular-nums">
                                      {row.reviewCount} lượt
                                    </span>
                                  </div>
                                  {row.satisfactionRate !== null && (
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-slate-300">Hài lòng (≥4★):</span>
                                      <span className="font-semibold text-emerald-400 tabular-nums">
                                        {row.satisfactionRate}%
                                      </span>
                                    </div>
                                  )}
                                  {effectiveServiceId === 'all' && row.bucketServices?.length > 0 && (
                                    <div className="pt-1 border-t border-slate-800 space-y-1">
                                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                        Chi tiết dịch vụ
                                      </span>
                                      {row.bucketServices.map((bs: any) => (
                                        <div
                                          key={bs.serviceId}
                                          className="flex items-center justify-between gap-3 text-[11px]"
                                        >
                                          <span className="text-slate-200 truncate max-w-[130px]">
                                            {bs.serviceName}
                                          </span>
                                          <span className="text-amber-300 font-semibold tabular-nums shrink-0">
                                            {bs.avgRating.toFixed(1)}★ ({bs.reviewCount})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-slate-400">Chưa có đánh giá nào</p>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        yAxisId="count"
                        dataKey="reviewCount"
                        name="Lượt đánh giá"
                        fill="#cbd5e1"
                        fillOpacity={0.6}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                      />
                      <Area
                        yAxisId="rating"
                        connectNulls
                        type="monotone"
                        dataKey="avgRating"
                        name="Điểm TB (★)"
                        stroke="#d97706"
                        strokeWidth={2.75}
                        fillOpacity={1}
                        fill="url(#amberRatingGradient)"
                        dot={{ r: 4, fill: '#fff', stroke: '#d97706', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#d97706', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  ) : (
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 14, right: isMobile ? 4 : 16, left: isMobile ? -20 : -8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[1, 5.2]}
                        ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v) => `${v}★`}
                        tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={4} stroke="#94a3b8" strokeDasharray="4 4" />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const row = payload[0]?.payload;
                          const validLines = payload.filter((p) => p.value !== null && p.value !== undefined);
                          return (
                            <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[190px]">
                              <p className="text-slate-300 font-medium border-b border-slate-800 pb-1">
                                {row?.fullLabel}
                              </p>
                              {validLines.length > 0 ? (
                                validLines.map((entry) => (
                                  <div
                                    key={String(entry.dataKey)}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="flex items-center gap-1.5 text-slate-200 truncate max-w-[140px]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: entry.color }}
                                      ></span>
                                      {entry.name}
                                    </span>
                                    <span className="font-bold text-amber-300 tabular-nums shrink-0">
                                      {Number(entry.value).toFixed(1)}★
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400">Chưa có đánh giá dịch vụ</p>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      {topCompareServices.map((svc, idx) => (
                        <Line
                          key={svc.serviceId}
                          connectNulls
                          type="monotone"
                          dataKey={`svc_${svc.serviceId}`}
                          name={svc.serviceName}
                          stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="h-[240px] flex flex-col items-center justify-center text-center px-4">
              <MessageSquareHeart className="w-9 h-9 text-slate-300 mb-2.5" />
              <p className="text-sm font-semibold text-slate-700">
                Chưa có dữ liệu đánh giá dịch vụ
                {timeRange !== 'all' ? ` trong ${timeRange} ngày gần đây` : ''}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Sau khi bác sĩ xác nhận hoàn tất khám và khách hàng gửi chấm điểm sao trên thiết bị đặt lịch, biểu đồ hài lòng sẽ hiển thị tự động tại đây.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {effectiveServiceId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedServiceId('all')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Xem tất cả dịch vụ
                  </button>
                )}
                {timeRange !== 'all' && onResetTimeRange && (
                  <button
                    type="button"
                    onClick={onResetTimeRange}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors cursor-pointer"
                  >
                    Mở rộng toàn bộ thời gian
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Split: Star Distribution & Per-Service Breakdown (no nested bordered cards) */}
        {analytics.summary.totalReviews > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border-t border-slate-100">
            {/* Star Distribution */}
            <div className="lg:col-span-5 p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Phân bổ điểm sao (Toàn kỳ)
                </h4>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {analytics.summary.totalReviews} lượt
                </span>
              </div>
              <div className="space-y-2">
                {(analytics.summary.starDistribution || []).map((row) => (
                  <div key={row.star} className="flex items-center gap-2.5 text-xs">
                    <span className="w-8 font-semibold text-slate-700 flex items-center gap-0.5 tabular-nums shrink-0">
                      {row.star}
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          row.star >= 4
                            ? 'bg-amber-400'
                            : row.star === 3
                              ? 'bg-amber-300'
                              : 'bg-rose-400'
                        }`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-slate-600 tabular-nums shrink-0">
                      {row.count} ({row.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clickable Service Rating Breakdown */}
            <div className="lg:col-span-7 p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Điểm hài lòng theo từng dịch vụ
                </h4>
                <span className="text-[11px] text-slate-400">
                  Bấm để xem biểu đồ riêng từng dịch vụ
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[210px] overflow-y-auto pr-1">
                {ratedServices.map((svc) => {
                  const isSelected = effectiveServiceId === svc.serviceId;
                  return (
                    <button
                      key={svc.serviceId}
                      type="button"
                      onClick={() =>
                        setSelectedServiceId(isSelected ? 'all' : svc.serviceId)
                      }
                      className={`w-full py-2 px-2.5 -mx-1 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/90 text-teal-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">
                            {svc.serviceName}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-600 text-white shrink-0">
                              Đang lọc
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {svc.reviewCount} lượt đánh giá • {svc.satisfactionRate}% hài lòng
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:block w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${(svc.avgRating / 5) * 100}%` }}
                          />
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-bold tabular-nums">
                          {svc.avgRating.toFixed(1)}
                          <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
