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
