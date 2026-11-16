import { db, loadStore } from "../db/index.js";
import { appContext } from "../core/context.js";
import { appointments, patients, providers, services } from "../db/schema.js";

export interface ServiceRatingStats {
  averageRating: number | null;
  actualAverageRating: number | null;
  ratedCount: number;
  totalSubmittedReviews: number;
  visibleReviewsCount: number;
  hiddenRatingsCount: number;
  hiddenReviewsCount: number;
  showRating: boolean;
  showReviews: boolean;
  hideRating: boolean;
  hideReviews: boolean;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function normalizeTenantId(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function clampRatingValue(val: any): number | null {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(5, Math.max(1, Number(num.toFixed(1))));
}

export function normalizeServiceRatingsMap(
  rawServiceRatings: any,
  serviceIds: string[],
  fallbackRating?: number | null
): Record<string, number> {
  const normalized: Record<string, number> = {};
  if (rawServiceRatings && typeof rawServiceRatings === "object" && !Array.isArray(rawServiceRatings)) {
    for (const [key, val] of Object.entries(rawServiceRatings)) {
      const cleanKey = String(key || "").trim();
      if (!cleanKey) continue;
      const rawScore = typeof val === "object" && val !== null ? (val as any).rating : val;
      const clamped = clampRatingValue(rawScore);
      if (clamped !== null) {
        normalized[cleanKey] = Math.round(clamped);
      }
    }
  }

  // Fill any registered serviceId missing a specific rating from fallbackRating
  if (fallbackRating && fallbackRating > 0) {
    const safeFallback = Math.min(5, Math.max(1, Math.round(Number(fallbackRating))));
    for (const sId of serviceIds) {
      if (sId && normalized[sId] === undefined) {
        normalized[sId] = safeFallback;
      }
    }
  }

  return normalized;
}

export function computeOverallRatingFromMap(
  serviceRatings: Record<string, number>,
  explicitRating?: number | null
): number {
  const values = Object.values(serviceRatings).filter((v) => typeof v === "number" && v >= 1 && v <= 5);
  if (values.length > 0) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Number(avg.toFixed(1));
  }
  const clamped = clampRatingValue(explicitRating);
  return clamped ?? 5;
}

function maskPatientName(fullName?: string | null): string {
  if (!fullName || !String(fullName).trim()) return "Khách hàng thân thiết";
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0]} ${parts
      .slice(1)
      .map((p) => (p[0] ? `${p[0].toUpperCase()}.` : ""))
      .filter(Boolean)
      .join(" ")}`;
  }
  return parts[0];
}

function resolveAppointmentServiceKeys(apt: any): string[] {
  const keys = new Set<string>();
  if (apt?.serviceId) keys.add(String(apt.serviceId).trim());
  if (Array.isArray(apt?.serviceIds)) {
    for (const sId of apt.serviceIds) {
      if (sId) keys.add(String(sId).trim());
    }
  }
  return Array.from(keys);
}

function getRatingForServiceInAppointment(
  apt: any,
  candidateIds: string[]
): number | null {
  if (apt?.serviceRatings && typeof apt.serviceRatings === "object") {
    for (const cid of candidateIds) {
      if (!cid) continue;
      const entry = apt.serviceRatings[cid];
      const rawScore = typeof entry === "object" && entry !== null ? entry.rating : entry;
      const clamped = clampRatingValue(rawScore);
      if (clamped !== null) return clamped;
    }
  }
  return clampRatingValue(apt?.rating);
}

async function loadTenantScopedData(tenantId: string | null) {
  const normalizedTarget = normalizeTenantId(tenantId);
  return await appContext.run({ tenantId: normalizedTarget, isFullAdmin: normalizedTarget === null }, async () => {
    const [allApts, allPatients, allProviders, allServices] = await Promise.all([
      db.select().from(appointments),
      db.select().from(patients),
      db.select().from(providers),
      db.select().from(services),
    ]);

    const scopedApts = (allApts as any[]).filter(
      (a) => normalizeTenantId(a.tenantId) === normalizedTarget
    );

    const patientMap = new Map<string, any>();
    for (const p of allPatients as any[]) {
      if (normalizeTenantId(p.tenantId) === normalizedTarget) {
        patientMap.set(p.id, p);
      }
    }

    const providerMap = new Map<string, any>();
    for (const pr of allProviders as any[]) {
      if (!pr.tenantId || normalizeTenantId(pr.tenantId) === normalizedTarget) {
        providerMap.set(pr.id, pr);
        if (pr.originalId && !providerMap.has(pr.originalId)) {
          providerMap.set(pr.originalId, pr);
        }
      }
    }

    const serviceMap = new Map<string, any>();
    for (const sv of allServices as any[]) {
      serviceMap.set(sv.id, sv);
      if (sv.originalId && !serviceMap.has(sv.originalId)) {
        serviceMap.set(sv.originalId, sv);
      }
    }

    return {
      appointments: scopedApts,
      patientMap,
      providerMap,
      serviceMap,
      servicesList: allServices as any[],
    };
  });
}

function emptyDistribution(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
}

export async function enrichServicesWithReviewStats<T extends Record<string, any>>(
  serviceList: T[],
  tenantId: string | null,
  options: { includeHidden?: boolean } = {}
): Promise<Array<T & { showRating: boolean; showReviews: boolean; ratingStats: ServiceRatingStats }>> {
  const includeHidden = Boolean(options.includeHidden);
  const { appointments: scopedApts } = await loadTenantScopedData(tenantId);

  const ratedAppointments = scopedApts.filter((a: any) => {
    const hasMain = clampRatingValue(a.rating) !== null;
    const hasPerSvc =
      a.serviceRatings &&
      typeof a.serviceRatings === "object" &&
      Object.values(a.serviceRatings).some((v: any) => clampRatingValue(typeof v === "object" ? v?.rating : v) !== null);
    return hasMain || hasPerSvc;
  });

  return serviceList.map((svc) => {
    const showRating = svc.showRating !== false;
    const showReviews = svc.showReviews !== false;
    const candidateIds = Array.from(
      new Set([svc.id, svc.originalId].filter(Boolean).map((x) => String(x).trim()))
    );

    const distribution = emptyDistribution();
    let totalRatingSum = 0;
    let ratedCount = 0;
    let totalSubmittedReviews = 0;
    let visibleReviewsCount = 0;
    let hiddenRatingsCount = 0;
    let hiddenReviewsCount = 0;

    for (const apt of ratedAppointments) {
      const aptServiceKeys = resolveAppointmentServiceKeys(apt);
      const matchesService = candidateIds.some((cid) => aptServiceKeys.includes(cid));
      if (!matchesService) continue;

      const svcRating = getRatingForServiceInAppointment(apt, candidateIds);
      if (svcRating === null) continue;

      totalSubmittedReviews += 1;

      const isRatingHidden = apt.isRatingHidden === true;
      const isReviewHidden = apt.isReviewHidden === true;

      if (isRatingHidden) {
        hiddenRatingsCount += 1;
      } else {
        ratedCount += 1;
        totalRatingSum += svcRating;
        const bucket = Math.min(5, Math.max(1, Math.round(svcRating))) as 1 | 2 | 3 | 4 | 5;
        distribution[bucket] += 1;
      }

      if (isReviewHidden) {
        hiddenReviewsCount += 1;
      } else {
        visibleReviewsCount += 1;
      }
    }

    const actualAverageRating =
      ratedCount > 0 ? Number((totalRatingSum / ratedCount).toFixed(1)) : null;

    const publicAverageRating =
      !includeHidden && !showRating ? null : actualAverageRating;
    const publicRatedCount = !includeHidden && !showRating ? 0 : ratedCount;
    const publicVisibleReviewsCount =
      !includeHidden && !showReviews ? 0 : visibleReviewsCount;
    const publicDistribution =
      !includeHidden && !showRating ? emptyDistribution() : distribution;

    return {
      ...svc,
      showRating,
      showReviews,
      ratingStats: {
        averageRating: publicAverageRating,
        actualAverageRating,
        ratedCount: publicRatedCount,
        totalSubmittedReviews,
        visibleReviewsCount: publicVisibleReviewsCount,
        hiddenRatingsCount,
        hiddenReviewsCount,
        showRating,
        showReviews,
        hideRating: !showRating,
        hideReviews: !showReviews,
        ratingDistribution: publicDistribution,
      },
    };
  });
}

export async function getPublicReviewsSummary(params: {
  tenantId: string | null;
  serviceId?: string | null;
  limit?: number;
}) {
  const { tenantId, serviceId, limit = 20 } = params;
  const cleanServiceId = serviceId ? String(serviceId).trim() : "";

  const {
    appointments: scopedApts,
    patientMap,
    providerMap,
    serviceMap,
  } = await loadTenantScopedData(tenantId);

  let targetServiceObj: any = null;
  let targetServiceCandidateIds: string[] = [];
  if (cleanServiceId) {
    targetServiceObj = serviceMap.get(cleanServiceId) || null;
    targetServiceCandidateIds = Array.from(
      new Set(
        [cleanServiceId, targetServiceObj?.id, targetServiceObj?.originalId]
          .filter(Boolean)
          .map((x) => String(x).trim())
      )
    );
  }

  const serviceAllowsRating = targetServiceObj ? targetServiceObj.showRating !== false : true;
  const serviceAllowsReviews = targetServiceObj ? targetServiceObj.showReviews !== false : true;

  const distribution = emptyDistribution();
  let sumRatings = 0;
  let ratedCount = 0;
  let positiveRatedCount = 0;
  let totalVisibleCards = 0;
  const visibleReviews: any[] = [];

  for (const apt of scopedApts) {
    const aptServiceKeys = resolveAppointmentServiceKeys(apt);

    // Filter by specific service when ?serviceId= is provided
    if (cleanServiceId) {
      const matchesTarget = targetServiceCandidateIds.some((cid) =>
        aptServiceKeys.includes(cid)
      );
      if (!matchesTarget) continue;
    }

    // Resolve applicable rating
    const resolvedRating = cleanServiceId
      ? getRatingForServiceInAppointment(apt, targetServiceCandidateIds)
      : clampRatingValue(apt.rating);

    if (resolvedRating === null) continue;

    // Check service-level visibility flags
    let effectiveServiceAllowsRating = serviceAllowsRating;
    let effectiveServiceAllowsReviews = serviceAllowsReviews;
    if (!cleanServiceId && aptServiceKeys.length > 0) {
      // Clinic-wide feed: if all services linked to this booking explicitly hide rating/reviews, honor it
      const matchedServices = aptServiceKeys
        .map((k) => serviceMap.get(k))
        .filter(Boolean);
      if (matchedServices.length > 0) {
        effectiveServiceAllowsRating = matchedServices.some((s: any) => s.showRating !== false);
        effectiveServiceAllowsReviews = matchedServices.some((s: any) => s.showReviews !== false);
      }
    }

    const rowRatingHidden = apt.isRatingHidden === true || !effectiveServiceAllowsRating;
    const rowReviewHidden = apt.isReviewHidden === true || !effectiveServiceAllowsReviews;

    // Numeric stars aggregation (STRICTLY decoupled from isReviewHidden so hiding comment does NOT erase stars unless isRatingHidden is also true)
    if (!rowRatingHidden) {
      ratedCount += 1;
      sumRatings += resolvedRating;
      if (resolvedRating >= 4) positiveRatedCount += 1;
      const bucket = Math.min(5, Math.max(1, Math.round(resolvedRating))) as 1 | 2 | 3 | 4 | 5;
      distribution[bucket] += 1;
    }

    // Public review comment / card output
    if (!rowReviewHidden) {
      totalVisibleCards += 1;
      const patient = patientMap.get(apt.patientId);
      const provider = providerMap.get(apt.providerId);
      const primaryService = serviceMap.get(apt.serviceId);

      // Build readable service list
      const resolvedServiceNames = aptServiceKeys
        .map((sId) => serviceMap.get(sId)?.name)
        .filter(Boolean);

      const serviceLabel = cleanServiceId && targetServiceObj?.name
        ? targetServiceObj.name
        : apt.customServiceName ||
          (resolvedServiceNames.length > 0 ? resolvedServiceNames.join(" + ") : primaryService?.name) ||
          "Dịch vụ nha khoa";

      const perServiceBreakdown =
        apt.serviceRatings && typeof apt.serviceRatings === "object"
          ? Object.entries(apt.serviceRatings).map(([sId, val]) => ({
              serviceId: sId,
              serviceName: serviceMap.get(sId)?.name || "Dịch vụ nha khoa",
              rating: rowRatingHidden
                ? null
                : clampRatingValue(typeof val === "object" && val !== null ? (val as any).rating : val),
            }))
          : [];

      visibleReviews.push({
        id: apt.id,
        rating: rowRatingHidden ? null : resolvedRating,
        isRatingHidden: rowRatingHidden,
        hideRating: rowRatingHidden,
        comment: apt.reviewComment ? String(apt.reviewComment).trim() : "",
        tags: Array.isArray(apt.reviewTags) ? apt.reviewTags : [],
        serviceId: cleanServiceId || apt.serviceId || null,
        serviceIds: aptServiceKeys,
        serviceName: serviceLabel,
        serviceRatings: perServiceBreakdown,
        providerName: provider?.name || "Bác sĩ chuyên khoa",
        patientName: maskPatientName(patient?.fullName || apt.bookedForName),
        date: apt.reviewedAt || apt.startAt,
        verified: true,
      });
    }
  }

  visibleReviews.sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  const avgRating =
    ratedCount > 0 ? Number((sumRatings / ratedCount).toFixed(1)) : 0;
  const satisfactionRate =
    ratedCount > 0 ? Math.round((positiveRatedCount / ratedCount) * 100) : 0;

  // Ensure clinic store reflects real submitted data even when service is brand new
  loadStore();

  return {
    stats: {
      averageRating: serviceAllowsRating ? avgRating : 0,
      totalReviews: Math.max(ratedCount, totalVisibleCards),
      ratedCount: serviceAllowsRating ? ratedCount : 0,
      visibleReviewsCount: serviceAllowsReviews ? totalVisibleCards : 0,
      satisfactionRate: ratedCount > 0 ? `${satisfactionRate}%` : "Chưa có đánh giá",
      ratingDistribution: serviceAllowsRating ? distribution : emptyDistribution(),
      showRating: serviceAllowsRating,
      showReviews: serviceAllowsReviews,
    },
    reviews: visibleReviews.slice(0, Math.max(1, limit)),
  };
}

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

export interface RatingAnalyticsResult {
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

function toVnDateStr(dateInput: any): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function toIsoWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function computeRatingAnalyticsOverTime(params: {
  appointments: any[];
  services: any[];
  tenantId: string | null;
  range: string;
}): RatingAnalyticsResult {
  const { appointments: rawAppointments, services: rawServices, tenantId, range } = params;
  const targetTenant = normalizeTenantId(tenantId);

  // Build canonical service map prioritizing clinic-owned services over root templates
  const canonicalServiceMap = new Map<string, any>();
  const sortedServices = [...(rawServices || [])].sort((a: any, b: any) => {
    const aOwned = normalizeTenantId(a.tenantId) === targetTenant ? 1 : 0;
    const bOwned = normalizeTenantId(b.tenantId) === targetTenant ? 1 : 0;
    return bOwned - aOwned;
  });

  for (const sv of sortedServices) {
    const svTenant = normalizeTenantId(sv.tenantId);
    if (targetTenant !== null && svTenant !== null && svTenant !== targetTenant) {
      continue;
    }
    if (sv.id && !canonicalServiceMap.has(String(sv.id))) {
      canonicalServiceMap.set(String(sv.id), sv);
    }
    if (sv.originalId && !canonicalServiceMap.has(String(sv.originalId))) {
      canonicalServiceMap.set(String(sv.originalId), sv);
    }
  }

  const daysRange = range === "7" ? 7 : range === "14" ? 14 : range === "30" ? 30 : 0;
  const todayStr = toVnDateStr(new Date())!;
  const cutoffStr = daysRange > 0 ? shiftDateStr(todayStr, -(daysRange - 1)) : null;

  type ExtractedReview = {
    dateStr: string;
    timestamp: number;
    overallRating: number;
    isRatingHidden: boolean;
    perService: Array<{ serviceId: string; serviceName: string; rating: number }>;
  };

  const extractedReviews: ExtractedReview[] = [];

  for (const apt of rawAppointments || []) {
    if (normalizeTenantId(apt.tenantId) !== targetTenant) continue;

    // Resolve per-service ratings + overall appointment rating
    const aptKeys = resolveAppointmentServiceKeys(apt);
    const serviceScoresMap = new Map<string, { serviceId: string; serviceName: string; rating: number }>();

    // Collect explicit entries from apt.serviceRatings
    if (apt.serviceRatings && typeof apt.serviceRatings === "object" && !Array.isArray(apt.serviceRatings)) {
      for (const [rawKey, rawVal] of Object.entries(apt.serviceRatings)) {
        const cleanKey = String(rawKey || "").trim();
        if (!cleanKey) continue;
        const rawScore = typeof rawVal === "object" && rawVal !== null ? (rawVal as any).rating : rawVal;
        const clamped = clampRatingValue(rawScore);
        if (clamped === null) continue;
        const svc = canonicalServiceMap.get(cleanKey);
        const canonicalId = svc?.id || cleanKey;
        const canonicalName = svc?.name || apt.customServiceName || "Dịch vụ nha khoa";
        serviceScoresMap.set(canonicalId, {
          serviceId: canonicalId,
          serviceName: canonicalName,
          rating: clamped,
        });
      }
    }

    const mainRating = clampRatingValue(apt.rating);
    for (const rawKey of aptKeys) {
      const svc = canonicalServiceMap.get(rawKey);
      const canonicalId = svc?.id || rawKey;
      if (!serviceScoresMap.has(canonicalId) && mainRating !== null) {
        serviceScoresMap.set(canonicalId, {
          serviceId: canonicalId,
          serviceName: svc?.name || apt.customServiceName || "Dịch vụ nha khoa",
          rating: mainRating,
        });
      }
    }

    const perService = Array.from(serviceScoresMap.values());
    let overallRating = mainRating;
    if (overallRating === null && perService.length > 0) {
      const sum = perService.reduce((acc, s) => acc + s.rating, 0);
      overallRating = Number((sum / perService.length).toFixed(2));
    }
    if (overallRating === null) continue;

    const dateSource = apt.reviewedAt || apt.updatedAt || apt.startAt || apt.createdAt;
    const dateStr = toVnDateStr(dateSource);
    if (!dateStr) continue;

    if (cutoffStr && (dateStr < cutoffStr || dateStr > todayStr)) {
      continue;
    }

    const ts = new Date(dateSource).getTime() || 0;
    extractedReviews.push({
      dateStr,
      timestamp: ts,
      overallRating,
      isRatingHidden: apt.isRatingHidden === true,
      perService,
    });
  }

  extractedReviews.sort((a, b) => a.timestamp - b.timestamp || a.dateStr.localeCompare(b.dateStr));

  const totalDist = emptyDistribution();
  let totalSum = 0;
  let totalReviews = 0;
  let positiveCount = 0;
  let fiveStarCount = 0;
  let lowRatingCount = 0;
  let hiddenRatingsCount = 0;

  type MutableBucket = {
    sum: number;
    count: number;
    positive: number;
    starBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
    serviceAccum: Map<string, { sum: number; count: number; positive: number }>;
  };

  const createBucket = (): MutableBucket => ({
    sum: 0,
    count: 0,
    positive: 0,
    starBreakdown: emptyDistribution(),
    serviceAccum: new Map(),
  });

  const dayMap = new Map<string, MutableBucket>();
  const weekMap = new Map<string, MutableBucket & { startDate: string; endDate: string }>();
  const serviceSummaryMap = new Map<
    string,
    {
      serviceId: string;
      serviceName: string;
      sum: number;
      count: number;
      positive: number;
      fiveStarCount: number;
      lowRatingCount: number;
      latestTs: number;
      latestDate: string | null;
    }
  >();

  if (daysRange > 0 && cutoffStr) {
    for (let i = daysRange - 1; i >= 0; i--) {
      const dStr = shiftDateStr(todayStr, -i);
      dayMap.set(dStr, createBucket());
    }
  }

  for (const rev of extractedReviews) {
    totalReviews += 1;
    totalSum += rev.overallRating;
    if (rev.overallRating >= 4) positiveCount += 1;
    const roundedStar = Math.min(5, Math.max(1, Math.round(rev.overallRating))) as 1 | 2 | 3 | 4 | 5;
    totalDist[roundedStar] += 1;
    if (roundedStar === 5) fiveStarCount += 1;
    if (roundedStar <= 3) lowRatingCount += 1;
    if (rev.isRatingHidden) hiddenRatingsCount += 1;

    // Day bucket
    if (!dayMap.has(rev.dateStr)) {
      dayMap.set(rev.dateStr, createBucket());
    }
    const dayBucket = dayMap.get(rev.dateStr)!;
    dayBucket.sum += rev.overallRating;
    dayBucket.count += 1;
    if (rev.overallRating >= 4) dayBucket.positive += 1;
    dayBucket.starBreakdown[roundedStar] += 1;

    // Week bucket
    const weekKey = toIsoWeekKey(rev.dateStr);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        ...createBucket(),
        startDate: rev.dateStr,
        endDate: rev.dateStr,
      });
    }
    const weekBucket = weekMap.get(weekKey)!;
    if (rev.dateStr < weekBucket.startDate) weekBucket.startDate = rev.dateStr;
    if (rev.dateStr > weekBucket.endDate) weekBucket.endDate = rev.dateStr;
    weekBucket.sum += rev.overallRating;
    weekBucket.count += 1;
    if (rev.overallRating >= 4) weekBucket.positive += 1;
    weekBucket.starBreakdown[roundedStar] += 1;

    // Per-service aggregation
    for (const svc of rev.perService) {
      const sPositive = svc.rating >= 4 ? 1 : 0;
      const sRounded = Math.min(5, Math.max(1, Math.round(svc.rating)));

      const dSvc = dayBucket.serviceAccum.get(svc.serviceId) || { sum: 0, count: 0, positive: 0 };
      dSvc.sum += svc.rating;
      dSvc.count += 1;
      dSvc.positive += sPositive;
      dayBucket.serviceAccum.set(svc.serviceId, dSvc);

      const wSvc = weekBucket.serviceAccum.get(svc.serviceId) || { sum: 0, count: 0, positive: 0 };
      wSvc.sum += svc.rating;
      wSvc.count += 1;
      wSvc.positive += sPositive;
      weekBucket.serviceAccum.set(svc.serviceId, wSvc);

      const existingSvc = serviceSummaryMap.get(svc.serviceId) || {
        serviceId: svc.serviceId,
        serviceName: svc.serviceName,
        sum: 0,
        count: 0,
        positive: 0,
        fiveStarCount: 0,
        lowRatingCount: 0,
        latestTs: 0,
        latestDate: null,
      };
      existingSvc.sum += svc.rating;
      existingSvc.count += 1;
      existingSvc.positive += sPositive;
      if (sRounded === 5) existingSvc.fiveStarCount += 1;
      if (sRounded <= 3) existingSvc.lowRatingCount += 1;
      if (rev.timestamp >= existingSvc.latestTs) {
        existingSvc.latestTs = rev.timestamp;
        existingSvc.latestDate = rev.dateStr;
      }
      serviceSummaryMap.set(svc.serviceId, existingSvc);
    }
  }

  const finalizeByService = (accum: Map<string, { sum: number; count: number; positive: number }>) => {
    const out: Record<string, RatingBucketServiceStat> = {};
    for (const [sId, st] of accum.entries()) {
      out[sId] = {
        avgRating: Number((st.sum / st.count).toFixed(2)),
        reviewCount: st.count,
        satisfactionRate: Math.round((st.positive / st.count) * 100),
      };
    }
    return out;
  };

  const ratingTrendByDay: RatingTrendDayPoint[] = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({
      date,
      avgRating: b.count > 0 ? Number((b.sum / b.count).toFixed(2)) : null,
      reviewCount: b.count,
      satisfactionRate: b.count > 0 ? Math.round((b.positive / b.count) * 100) : null,
      starBreakdown: b.starBreakdown,
      byService: finalizeByService(b.serviceAccum),
    }));

  const ratingTrendByWeek: RatingTrendWeekPoint[] = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, b]) => ({
      week,
      startDate: b.startDate,
      endDate: b.endDate,
      avgRating: b.count > 0 ? Number((b.sum / b.count).toFixed(2)) : null,
      reviewCount: b.count,
      satisfactionRate: b.count > 0 ? Math.round((b.positive / b.count) * 100) : null,
      starBreakdown: b.starBreakdown,
      byService: finalizeByService(b.serviceAccum),
    }));

  const ratedServices: RatedServiceSummary[] = Array.from(serviceSummaryMap.values())
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      avgRating: Number((s.sum / s.count).toFixed(2)),
      reviewCount: s.count,
      satisfactionRate: Math.round((s.positive / s.count) * 100),
      fiveStarCount: s.fiveStarCount,
      lowRatingCount: s.lowRatingCount,
      latestRatedAt: s.latestDate,
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount || b.avgRating - a.avgRating);

  // Trend delta: compare second half vs first half of chronological reviews in the period
  let trendDelta: number | null = null;
  if (extractedReviews.length >= 2) {
    const mid = Math.floor(extractedReviews.length / 2);
    const firstHalf = extractedReviews.slice(0, mid);
    const secondHalf = extractedReviews.slice(mid);
    const firstAvg = firstHalf.reduce((acc, r) => acc + r.overallRating, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((acc, r) => acc + r.overallRating, 0) / secondHalf.length;
    trendDelta = Number((secondAvg - firstAvg).toFixed(2));
  }

  const starDistribution = ([5, 4, 3, 2, 1] as const).map((star) => ({
    star,
    count: totalDist[star],
    percent: totalReviews > 0 ? Math.round((totalDist[star] / totalReviews) * 100) : 0,
  }));

  return {
    summary: {
      averageRating: totalReviews > 0 ? Number((totalSum / totalReviews).toFixed(2)) : null,
      totalReviews,
      satisfactionRate: totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0,
      fiveStarRate: totalReviews > 0 ? Math.round((fiveStarCount / totalReviews) * 100) : 0,
      lowRatingCount,
      hiddenRatingsCount,
      trendDelta,
      starDistribution,
    },
    ratingTrendByDay,
    ratingTrendByWeek,
    ratedServices,
  };
}

