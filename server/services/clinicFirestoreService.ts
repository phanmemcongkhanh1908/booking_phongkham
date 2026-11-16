import { adminDb } from "../lib/firebase-admin.js";
import { serverDb, firestoreFns } from "../lib/firebase-server.js";
import { db } from "../db/index.js";
import { users, settings, providers, services } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { appContext } from "../core/context.js";

let adminDbUnavailable = false;
let firestoreNotFoundUntil = 0;
const SLUG_CACHE_TTL_MS = 30_000;
const slugConfigCache = new Map<string, { config: ClinicConfig; expiresAt: number }>();
const lastFirestoreSyncMap = new Map<string, number>();

export function invalidateClinicSlugCache(slug?: string) {
  if (slug) {
    slugConfigCache.delete(slug.trim().toLowerCase());
  } else {
    slugConfigCache.clear();
  }
}

function isPermissionOrCredentialError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("UNAUTHENTICATED") ||
    msg.includes("Could not load the default credentials")
  );
}

function isNotFoundDbError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return msg.includes("NOT_FOUND") || err?.code === 5;
}

export interface BusinessHoursInfo {
  workingHoursStr: string;
  openTime: string;
  closeTime: string;
  days: string[];
  isOpenToday: boolean;
  isCurrentlyOpen: boolean;
  scheduleSummary: string;
}

export interface ClinicBrandingInfo {
  clinicName: string;
  name: string;
  doctorName?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  hotline?: string;
  logoUrl?: string;
  coverUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  theme?: string;
  slug?: string;
  workingHours?: string;
  workingHoursStr?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ClinicConfig {
  clinicName: string;
  doctorName?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  hotline?: string;
  workingHours?: string;
  workingHoursStr?: string;
  latitude?: number | null;
  longitude?: number | null;
  tenantId?: string;
  slug?: string;
  source: "firestore" | "local_db" | "default";
  bookingFormConfig?: any;
  announcementBanner?: any;
  telegramBotUsername?: string;
  logoUrl?: string;
  coverUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  theme?: string;
}

function parseCoord(val: any, min: number, max: number): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Number(n.toFixed(6));
}

export interface ClinicFullBundle {
  clinicProfile: ClinicBrandingInfo;
  branding: ClinicBrandingInfo;
  businessHours: BusinessHoursInfo;
  services: any[];
  providers: any[];
  bookingFormConfig: any;
  announcementBanner: any;
  telegramBotUsername: string | null;
  tenantId: string | null;
  slug: string | null;
  source: string;
}

/**
 * Extracts clinic slug from subdomain if present (e.g. lephuong.domain.com -> lephuong)
 */
export function extractSubdomainFromHost(host: string | undefined): string | null {
  if (!host) return null;
  const cleanHost = host.split(':')[0].toLowerCase();
  const parts = cleanHost.split('.');
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }
  if (parts.length >= 3) {
    const sub = parts[0];
    const reserved = ['www', 'api', 'app', 'dev', 'stage', 'preview', 'admin', 'auth', 'mail', 'static'];
    if (!reserved.includes(sub) && !sub.startsWith('ais-dev-') && !sub.startsWith('ais-pre-') && !sub.startsWith('ais-app-') && !sub.includes('run.app')) {
      return sub;
    }
  }
  return null;
}

/**
 * Executes a Firestore query with a safety timeout so it never hangs if network or credentials stall
 */
async function withTimeout<T>(promiseFn: () => Promise<T>, timeoutMs = 2500): Promise<T | null> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promiseFn(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    console.warn("[FirestoreService] Query error (handled gracefully):", err?.message || err);
    return null;
  }
}

/**
 * Look up clinic configuration by slug across Firestore collections and local database
 */
export async function findClinicBySlug(slug: string): Promise<ClinicConfig | null> {
  if (!slug || !slug.trim()) return null;
  const cleanSlug = slug.trim().toLowerCase();

  // STEP 0: Fast in-memory cache check (<0.01ms)
  const cached = slugConfigCache.get(cleanSlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  // STEP 1: Fast Local Database Check FIRST (<0.1ms, avoids 2500ms Firestore round-trip per booking request)
  let matchedUser: any = null;
  let targetTenantId: string | undefined = undefined;

  await appContext.run({ isFullAdmin: true }, async () => {
    try {
      const allUsers = await db.select().from(users);
      matchedUser = allUsers.find((u: any) => {
        const uSlug = (u.slug || "").trim().toLowerCase();
        const uUsername = (u.username || "").trim().toLowerCase();
        const uEmail = (u.email || "").trim().toLowerCase();
        const uId = (u.id || "").trim();
        return uSlug === cleanSlug || uUsername === cleanSlug || uEmail === cleanSlug || uId === cleanSlug;
      });

      if (matchedUser) {
        targetTenantId = matchedUser.tenantId || `tenant_${matchedUser.id}`;
        if (!matchedUser.tenantId) {
          await db.update(users).set({ tenantId: targetTenantId }).where(eq(users.id, matchedUser.id));
        }
      }
    } catch (dbErr: any) {
      console.error("[ClinicLookup] Local DB query error:", dbErr);
    }
  });

  if (matchedUser) {
    let customProfileFromSettings: any = null;
    let formConfig: any = null;

    await appContext.run({ tenantId: targetTenantId }, async () => {
      try {
        const settingRows = await db.select().from(settings);
        const profileSetting = settingRows.find(
          (s: any) => s.id === "clinicProfile" || s.id === "clinic_profile" || s.key === "clinicProfile" || s.key === "clinic_profile"
        );
        if (profileSetting?.value) {
          customProfileFromSettings =
            typeof profileSetting.value === "string"
              ? JSON.parse(profileSetting.value)
              : profileSetting.value;
        }

        const configSetting = settingRows.find(
          (s: any) => s.id === "bookingFormConfig" || s.key === "bookingFormConfig"
        );
        if (configSetting?.value) {
          formConfig =
            typeof configSetting.value === "string"
              ? JSON.parse(configSetting.value)
              : configSetting.value;
        }
      } catch (err) {
        console.warn("[ClinicLookup] Error fetching tenant settings:", err);
      }
    });

    let resolvedDoctorName = matchedUser.doctorName || customProfileFromSettings?.doctorName || "";
    if (!resolvedDoctorName && targetTenantId) {
      try {
        await appContext.run({ tenantId: targetTenantId }, async () => {
          const tenantProviders = await db.select().from(providers);
          const activeProv = tenantProviders.find((p: any) => p.isActive !== false);
          if (activeProv) {
            resolvedDoctorName = activeProv.name;
          }
        });
      } catch {}
    }

    const resolvedClinicName =
      customProfileFromSettings?.clinicName ||
      customProfileFromSettings?.name ||
      matchedUser.clinicName ||
      "Nha Khoa Dental Smart";
    const resolvedAddress =
      customProfileFromSettings?.address ||
      matchedUser.address ||
      "";
    const resolvedPhone =
      customProfileFromSettings?.phone ||
      customProfileFromSettings?.hotline ||
      matchedUser.phone ||
      matchedUser.hotline ||
      "";
    const resolvedHotline =
      customProfileFromSettings?.hotline ||
      customProfileFromSettings?.phone ||
      matchedUser.hotline ||
      matchedUser.phone ||
      "";
    const resolvedWorkingHours =
      (
        customProfileFromSettings?.workingHours ||
        customProfileFromSettings?.workingHoursStr ||
        matchedUser.workingHoursStr ||
        ""
      )
        .toString()
        .trim();
    const resolvedSlogan =
      customProfileFromSettings?.slogan !== undefined && customProfileFromSettings?.slogan !== ""
        ? customProfileFromSettings.slogan
        : matchedUser.slogan || "";

    const resolvedLatitude = parseCoord(
      customProfileFromSettings?.latitude !== undefined
        ? customProfileFromSettings.latitude
        : matchedUser.latitude,
      -90,
      90
    );
    const resolvedLongitude = parseCoord(
      customProfileFromSettings?.longitude !== undefined
        ? customProfileFromSettings.longitude
        : matchedUser.longitude,
      -180,
      180
    );

    const clinicConfig: ClinicConfig = {
      clinicName: resolvedClinicName,
      doctorName: resolvedDoctorName,
      slogan: resolvedSlogan,
      address: resolvedAddress,
      phone: resolvedPhone,
      hotline: resolvedHotline,
      workingHours: resolvedWorkingHours,
      workingHoursStr: resolvedWorkingHours,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      tenantId: targetTenantId,
      slug: cleanSlug,
      source: "local_db",
      bookingFormConfig: formConfig,
    };

    slugConfigCache.set(cleanSlug, { config: clinicConfig, expiresAt: Date.now() + SLUG_CACHE_TTL_MS });

    // Background sync to Firestore at most once every 5 minutes per slug
    const lastSync = lastFirestoreSyncMap.get(cleanSlug) || 0;
    if (Date.now() > firestoreNotFoundUntil && Date.now() - lastSync > 300_000) {
      lastFirestoreSyncMap.set(cleanSlug, Date.now());
      syncClinicToFirestore(cleanSlug, clinicConfig).catch(() => {});
    }

    return clinicConfig;
  }

  // STEP 2: Fallback to Firestore only when slug is not found in local DB (and circuit breaker allows)
  if (Date.now() < firestoreNotFoundUntil) {
    return null;
  }

  const firestoreResult = await withTimeout(async () => {
    if (!adminDbUnavailable && adminDb && typeof adminDb.collection === "function") {
      try {
        const clinicDoc = await adminDb.collection("clinics").doc(cleanSlug).get();
        if (clinicDoc.exists) {
          return mapFirestoreData(clinicDoc.data(), clinicDoc.id, cleanSlug);
        }

        const clinicQuery = await adminDb.collection("clinics").where("slug", "==", cleanSlug).limit(1).get();
        if (!clinicQuery.empty) {
          const docSnap = clinicQuery.docs[0];
          return mapFirestoreData(docSnap.data(), docSnap.id, cleanSlug);
        }

        const userQuery = await adminDb.collection("users").where("slug", "==", cleanSlug).limit(1).get();
        if (!userQuery.empty) {
          const docSnap = userQuery.docs[0];
          return mapFirestoreData(docSnap.data(), docSnap.id, cleanSlug);
        }

        const settingDoc = await adminDb.collection("settings").doc(`clinicProfile_${cleanSlug}`).get();
        if (settingDoc.exists) {
          const val = settingDoc.data()?.value || settingDoc.data();
          return mapFirestoreData(val, settingDoc.id, cleanSlug);
        }

        const cpDoc = await adminDb.collection("clinic_profiles").doc(cleanSlug).get();
        if (cpDoc.exists) {
          return mapFirestoreData(cpDoc.data(), cpDoc.id, cleanSlug);
        }
      } catch (err: any) {
        if (isPermissionOrCredentialError(err)) {
          adminDbUnavailable = true;
        } else if (isNotFoundDbError(err)) {
          firestoreNotFoundUntil = Date.now() + 60_000;
        } else {
          console.warn("[ClinicLookup][adminDb] Query failed:", err?.message || err);
        }
      }
    }

    if (serverDb && Date.now() >= firestoreNotFoundUntil) {
      try {
        const { doc, getDoc, collection, query, where, getDocs, limit } = firestoreFns;

        const cRef = doc(serverDb, "clinics", cleanSlug);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          return mapFirestoreData(cSnap.data(), cSnap.id, cleanSlug);
        }

        const cq = query(collection(serverDb, "clinics"), where("slug", "==", cleanSlug), limit(1));
        const cqSnap = await getDocs(cq);
        if (!cqSnap.empty) {
          const d = cqSnap.docs[0];
          return mapFirestoreData(d.data(), d.id, cleanSlug);
        }
      } catch (err: any) {
        if (isNotFoundDbError(err)) {
          firestoreNotFoundUntil = Date.now() + 60_000;
        } else {
          console.warn("[ClinicLookup][serverDb] Query failed:", err?.message || err);
        }
      }
    }

    return null;
  }, 1500);

  if (firestoreResult) {
    slugConfigCache.set(cleanSlug, { config: firestoreResult, expiresAt: Date.now() + SLUG_CACHE_TTL_MS });
    return firestoreResult;
  }

  return null;
}

/**
 * Maps raw Firestore document data into standardized ClinicConfig
 */
function mapFirestoreData(data: any, docId: string, slug: string): ClinicConfig {
  if (!data) {
    return {
      clinicName: "Nha Khoa Dental Smart",
      source: "firestore",
      slug,
    };
  }

  const clinicName = 
    data.clinicName || 
    data.name || 
    data.clinic_name || 
    data.title || 
    "Nha Khoa Dental Smart";

  const doctorName = 
    data.doctorName || 
    data.doctor || 
    data.bacSiPhuTrach || 
    data.doctorInCharge || 
    data.leadDoctor || 
    data.physician || 
    "";

  const phone = data.phone || data.hotline || data.soDienThoai || "";
  const hotline = data.hotline || data.phone || data.soDienThoai || "";
  const workingHours = data.workingHours || data.workingHoursStr || data.gioLamViec || "";
  const address = data.address || data.diaChi || "";
  const slogan = data.slogan || data.description || data.tagline || "";

  return {
    clinicName,
    doctorName,
    slogan,
    address,
    phone,
    hotline,
    workingHours,
    workingHoursStr: workingHours,
    latitude: parseCoord(data.latitude ?? data.lat, -90, 90),
    longitude: parseCoord(data.longitude ?? data.lng ?? data.lon, -180, 180),
    tenantId: data.tenantId || `tenant_${docId}`,
    slug: data.slug || slug,
    source: "firestore",
    bookingFormConfig: data.bookingFormConfig,
    announcementBanner: data.announcementBanner,
    telegramBotUsername: data.telegramBotUsername,
  };
}

/**
 * Asynchronously syncs or upserts a clinic document to Firestore
 */
export async function syncClinicToFirestore(slug: string, config: Partial<ClinicConfig>): Promise<boolean> {
  if (!slug) return false;
  const cleanSlug = slug.trim().toLowerCase();
  invalidateClinicSlugCache(cleanSlug);
  if (Date.now() < firestoreNotFoundUntil) return false;

  try {
    const lat = parseCoord(config.latitude, -90, 90);
    const lng = parseCoord(config.longitude, -180, 180);
    const payload: Record<string, any> = {
      slug: cleanSlug,
      clinicName: config.clinicName || "Nha Khoa Dental Smart",
      doctorName: config.doctorName || "",
      address: config.address || "",
      phone: config.phone || config.hotline || "",
      hotline: config.hotline || config.phone || "",
      workingHours: config.workingHours || config.workingHoursStr || "",
      workingHoursStr: config.workingHoursStr || config.workingHours || "",
      slogan: config.slogan || "",
      tenantId: config.tenantId || `tenant_${cleanSlug}`,
      updatedAt: new Date().toISOString(),
    };
    if (lat !== null && lng !== null) {
      payload.latitude = lat;
      payload.longitude = lng;
    }

    if (!adminDbUnavailable && adminDb && typeof adminDb.collection === "function") {
      try {
        await adminDb.collection("clinics").doc(cleanSlug).set(payload, { merge: true });
        return true;
      } catch (adminErr: any) {
        if (isPermissionOrCredentialError(adminErr)) {
          adminDbUnavailable = true;
        } else if (isNotFoundDbError(adminErr)) {
          firestoreNotFoundUntil = Date.now() + 60_000;
          return false;
        } else {
          console.warn(`[ClinicSync][adminDb] Failed to sync clinic "${cleanSlug}":`, adminErr?.message || adminErr);
        }
      }
    }

    if (serverDb && Date.now() >= firestoreNotFoundUntil) {
      const { doc, setDoc } = firestoreFns;
      await setDoc(doc(serverDb, "clinics", cleanSlug), payload, { merge: true });
      return true;
    }
  } catch (err: any) {
    if (isNotFoundDbError(err)) {
      firestoreNotFoundUntil = Date.now() + 60_000;
    } else {
      console.warn(`[ClinicSync] Failed to sync clinic "${cleanSlug}" to Firestore:`, err?.message || err);
    }
  }
  return false;
}

const DAY_ORDER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

function parseDayTokenIndex(token: string): number | null {
  const t = token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!t) return null;
  if (t.includes('chu nhat') || t === 'cn') return 6;
  if (t.includes('bay') || t.includes('t7') || t.includes('thu 7')) return 5;
  if (t.includes('sau') || t.includes('t6') || t.includes('thu 6')) return 4;
  if (t.includes('nam') || t.includes('t5') || t.includes('thu 5')) return 3;
  if (t.includes('tu') || t.includes('t4') || t.includes('thu 4')) return 2;
  if (t.includes('ba') || t.includes('t3') || t.includes('thu 3')) return 1;
  if (t.includes('hai') || t.includes('t2') || t.includes('thu 2')) return 0;
  return null;
}

function extractDaysFromSegment(segment: string): string[] | null {
  const norm = segment
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const dayRegex = /(?:thu\s*(?:2|3|4|5|6|7|hai|bay|ba|tu|nam|sau)(?![a-z])|chu\s*nhat(?![a-z])|\bt[2-7]\b|\bcn\b)/g;
  const matches: Array<{ idx: number; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = dayRegex.exec(norm)) !== null) {
    const dayIdx = parseDayTokenIndex(m[0]);
    if (dayIdx !== null) {
      matches.push({ idx: dayIdx, start: m.index, end: m.index + m[0].length });
    }
  }
  if (matches.length === 0) return null;

  const selected = new Set<string>();
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const next = matches[i + 1];
    if (next) {
      const between = norm.slice(curr.end, next.start);
      if (/^\s*(?:[-–—]|den|toi)\s*$/i.test(between)) {
        if (curr.idx <= next.idx) {
          for (let d = curr.idx; d <= next.idx; d++) {
            selected.add(DAY_ORDER[d]);
          }
        } else {
          for (let d = curr.idx; d < DAY_ORDER.length; d++) selected.add(DAY_ORDER[d]);
          for (let d = 0; d <= next.idx; d++) selected.add(DAY_ORDER[d]);
        }
        i++; // Skip next since we consumed range pair
        continue;
      }
    }
    selected.add(DAY_ORDER[curr.idx]);
  }
  return DAY_ORDER.filter((d) => selected.has(d));
}

function extractTimeIntervals(segment: string): Array<{ startStr: string; endStr: string; startMins: number; endMins: number }> {
  const results: Array<{ startStr: string; endStr: string; startMins: number; endMins: number }> = [];
  const regex = /(\d{1,2})\s*[:hH]\s*(\d{2})\s*(?:[-–—]|đến|tới)+\s*(\d{1,2})\s*[:hH]\s*(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(segment)) !== null) {
    const sh = Math.min(23, parseInt(m[1], 10));
    const sm = Math.min(59, parseInt(m[2], 10));
    const eh = Math.min(23, parseInt(m[3], 10));
    const em = Math.min(59, parseInt(m[4], 10));
    const startStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const endStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    results.push({
      startStr,
      endStr,
      startMins: sh * 60 + sm,
      endMins: eh * 60 + em,
    });
  }
  return results;
}

/**
 * Parses working hours string into structured format and checks open status
 * Supports multi-segment Vietnamese schedules (e.g. "17:00 - 20:00 (Thứ 2 - Thứ 5) và 7:30 - 20:00 (Thứ bảy - Chủ nhật)")
 */
export function parseBusinessHours(hoursStr?: string, referenceDate?: Date): BusinessHoursInfo {
  const defaultHours = "T2 - CN: 08:00 - 20:00";
  const raw = (hoursStr || "").trim() || defaultHours;

  // Calculate current Vietnam time (GMT+7)
  const now = referenceDate || new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const vnTime = new Date(utc + 3600000 * 7);
  const currentDayIndex = vnTime.getDay(); // 0 is Sunday, 1 is Monday...
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const currentDayName = dayNames[currentDayIndex];
  const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes();

  const segments = raw
    .split(/(?:\s+và\s+|;|\||\n)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const allDaysSet = new Set<string>();
  const todayIntervals: Array<{ startStr: string; endStr: string; startMins: number; endMins: number }> = [];
  const fallbackIntervals = extractTimeIntervals(raw);

  for (const seg of segments) {
    const segDays = extractDaysFromSegment(seg) || [...DAY_ORDER];
    const segTimes = extractTimeIntervals(seg);
    if (segTimes.length > 0) {
      segDays.forEach((d) => allDaysSet.add(d));
      if (segDays.includes(currentDayName)) {
        todayIntervals.push(...segTimes);
      }
    }
  }

  const days =
    allDaysSet.size > 0
      ? DAY_ORDER.filter((d) => allDaysSet.has(d))
      : extractDaysFromSegment(raw) || [...DAY_ORDER];

  const activeIntervals = todayIntervals.length > 0 ? todayIntervals : fallbackIntervals;
  const openTime = activeIntervals[0]?.startStr || "08:00";
  const closeTime = activeIntervals[activeIntervals.length - 1]?.endStr || "20:00";

  const isOpenToday = todayIntervals.length > 0 || (fallbackIntervals.length > 0 && days.includes(currentDayName));
  const isCurrentlyOpen =
    isOpenToday &&
    todayIntervals.some((iv) => currentMinutes >= iv.startMins && currentMinutes <= iv.endMins);

  return {
    workingHoursStr: raw,
    openTime,
    closeTime,
    days,
    isOpenToday,
    isCurrentlyOpen,
    scheduleSummary: raw,
  };
}

/**
 * Resolves the full configuration bundle for a clinic
 */
export async function getClinicFullBundle(slugOrDomain?: string): Promise<ClinicFullBundle> {
  const cleanSlug = (slugOrDomain || "").trim().toLowerCase();
  let clinicConfig: ClinicConfig | null = null;
  
  if (cleanSlug) {
    clinicConfig = await findClinicBySlug(cleanSlug);
  }

  const tenantId = clinicConfig?.tenantId || (cleanSlug ? `tenant_${cleanSlug}` : null);

  const businessHours = parseBusinessHours(clinicConfig?.workingHoursStr || clinicConfig?.workingHours);

  // Fallback default profile if not found
  const clinicProfile: ClinicBrandingInfo = {
    clinicName: clinicConfig?.clinicName || "Nha Khoa Dental Smart",
    name: clinicConfig?.clinicName || "Nha Khoa Dental Smart",
    doctorName: clinicConfig?.doctorName || "Bs. Chuyên Khoa Răng Hàm Mặt",
    slogan: clinicConfig?.slogan || "Nụ cười rạng rỡ, tự tin đón tương lai",
    address: clinicConfig?.address || "123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
    phone: clinicConfig?.phone || clinicConfig?.hotline || "0901 234 567",
    hotline: clinicConfig?.hotline || clinicConfig?.phone || "0901 234 567",
    logoUrl: clinicConfig?.logoUrl || "",
    coverUrl: clinicConfig?.coverUrl || "",
    primaryColor: clinicConfig?.primaryColor || "#0d9488",
    accentColor: clinicConfig?.accentColor || "#14b8a6",
    theme: clinicConfig?.theme || "teal",
    slug: clinicConfig?.slug || cleanSlug || "",
    workingHours: businessHours.workingHoursStr,
    workingHoursStr: businessHours.workingHoursStr,
    latitude: clinicConfig?.latitude ?? null,
    longitude: clinicConfig?.longitude ?? null,
  };

  let activeServices: any[] = [];
  let activeProviders: any[] = [];

  await appContext.run({ tenantId }, async () => {
    try {
      const allServices = await db.select().from(services);
      const filteredServices = allServices.filter((s: any) => s.isActive !== false);
      try {
        const { enrichServicesWithReviewStats } = await import("./reviewAggregation.js");
        activeServices = await enrichServicesWithReviewStats(filteredServices, tenantId, {
          includeHidden: false,
        });
      } catch (statsErr) {
        console.warn("[ClinicBundle] Error enriching service review stats:", statsErr);
        activeServices = filteredServices;
      }

      const allProviders = await db.select().from(providers);
      activeProviders = allProviders.filter((p: any) => p.isActive !== false);
    } catch (e) {
      console.warn("[ClinicBundle] Error loading services/providers for tenant:", e);
    }
  });

  // Get Telegram Bot username if configured
  let botUsername: string | null = null;
  try {
    const { getTelegramBotUsername } = await import("../core/telegram.js");
    botUsername = await getTelegramBotUsername();
  } catch (e) {}

  return {
    clinicProfile,
    branding: clinicProfile,
    businessHours,
    services: activeServices,
    providers: activeProviders,
    bookingFormConfig: clinicConfig?.bookingFormConfig || {
      uiVersion: "full",
      showNotificationChannels: true,
      showHoldCountdown: true,
      quickNotesTags: ["Khám tổng quát", "Nhổ răng", "Lấy cao răng", "Trám răng thẩm mỹ"]
    },
    announcementBanner: clinicConfig?.announcementBanner || null,
    telegramBotUsername: botUsername,
    tenantId,
    slug: clinicConfig?.slug || cleanSlug || null,
    source: clinicConfig?.source || "default",
  };
}
