import { adminDb } from "../lib/firebase-admin.js";
import { serverDb } from "../lib/firebase-server.js";
import { db } from "../db/index.js";
import { users, settings, providers, services } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { appContext } from "../core/context.js";

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

  console.log(`[ClinicLookup] Initiating search for clinic document with slug: "${cleanSlug}"`);

  // -------------------------------------------------------------
  // STEP 1: Query Firestore for matching clinic document
  // Collections checked: 'clinics', 'users', 'settings', 'clinic_profiles'
  // -------------------------------------------------------------
  const firestoreResult = await withTimeout(async () => {
    // 1.1 Try adminDb if initialized
    if (adminDb && typeof adminDb.collection === "function") {
      try {
        // A. Check 'clinics' by ID
        const clinicDoc = await adminDb.collection("clinics").doc(cleanSlug).get();
        if (clinicDoc.exists) {
          console.log(`[ClinicLookup][Firestore] Found doc in 'clinics' by ID: "${cleanSlug}"`);
          return mapFirestoreData(clinicDoc.data(), clinicDoc.id, cleanSlug);
        }

        // B. Check 'clinics' by slug field
        const clinicQuery = await adminDb.collection("clinics").where("slug", "==", cleanSlug).limit(1).get();
        if (!clinicQuery.empty) {
          const doc = clinicQuery.docs[0];
          console.log(`[ClinicLookup][Firestore] Found doc in 'clinics' by slug query: "${cleanSlug}"`);
          return mapFirestoreData(doc.data(), doc.id, cleanSlug);
        }

        // C. Check 'users' by slug field
        const userQuery = await adminDb.collection("users").where("slug", "==", cleanSlug).limit(1).get();
        if (!userQuery.empty) {
          const doc = userQuery.docs[0];
          console.log(`[ClinicLookup][Firestore] Found user doc in 'users' by slug query: "${cleanSlug}"`);
          return mapFirestoreData(doc.data(), doc.id, cleanSlug);
        }

        // D. Check 'settings' by clinicProfile_${cleanSlug}
        const settingDoc = await adminDb.collection("settings").doc(`clinicProfile_${cleanSlug}`).get();
        if (settingDoc.exists) {
          console.log(`[ClinicLookup][Firestore] Found setting doc for: "${cleanSlug}"`);
          const val = settingDoc.data()?.value || settingDoc.data();
          return mapFirestoreData(val, settingDoc.id, cleanSlug);
        }

        // E. Check 'clinic_profiles' by ID or slug
        const cpDoc = await adminDb.collection("clinic_profiles").doc(cleanSlug).get();
        if (cpDoc.exists) {
          console.log(`[ClinicLookup][Firestore] Found doc in 'clinic_profiles': "${cleanSlug}"`);
          return mapFirestoreData(cpDoc.data(), cpDoc.id, cleanSlug);
        }
      } catch (err: any) {
        console.warn("[ClinicLookup][adminDb] Query failed:", err?.message || err);
      }
    }

    // 1.2 Try serverDb (client-SDK format) if adminDb did not find it
    if (serverDb) {
      try {
        const { doc, getDoc, collection, query, where, getDocs, limit } = await import("firebase/firestore");
        
        // A. Check 'clinics' doc
        const cRef = doc(serverDb, "clinics", cleanSlug);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          console.log(`[ClinicLookup][serverDb] Found doc in 'clinics' by ID: "${cleanSlug}"`);
          return mapFirestoreData(cSnap.data(), cSnap.id, cleanSlug);
        }

        // B. Query 'clinics' where slug == cleanSlug
        const cq = query(collection(serverDb, "clinics"), where("slug", "==", cleanSlug), limit(1));
        const cqSnap = await getDocs(cq);
        if (!cqSnap.empty) {
          const d = cqSnap.docs[0];
          console.log(`[ClinicLookup][serverDb] Found doc in 'clinics' by slug: "${cleanSlug}"`);
          return mapFirestoreData(d.data(), d.id, cleanSlug);
        }

        // C. Query 'users' where slug == cleanSlug
        const uq = query(collection(serverDb, "users"), where("slug", "==", cleanSlug), limit(1));
        const uqSnap = await getDocs(uq);
        if (!uqSnap.empty) {
          const d = uqSnap.docs[0];
          console.log(`[ClinicLookup][serverDb] Found doc in 'users' by slug: "${cleanSlug}"`);
          return mapFirestoreData(d.data(), d.id, cleanSlug);
        }
      } catch (err: any) {
        console.warn("[ClinicLookup][serverDb] Query failed:", err?.message || err);
      }
    }

    return null;
  }, 2500);

  if (firestoreResult) {
    console.log(`[ClinicLookup] Successfully resolved clinic from Firestore:`, {
      clinicName: firestoreResult.clinicName,
      doctorName: firestoreResult.doctorName,
      tenantId: firestoreResult.tenantId,
    });
    return firestoreResult;
  }

  // -------------------------------------------------------------
  // STEP 2: Query Local Database (server/db/index.ts)
  // -------------------------------------------------------------
  console.log(`[ClinicLookup] Firestore yielded no direct hit. Searching local database for slug: "${cleanSlug}"`);

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
    console.log(`[ClinicLookup][LocalDB] Matched user account: "${matchedUser.email}" with tenantId: "${targetTenantId}"`);

    // Fetch custom clinic profile from settings if available
    let customProfileFromSettings: any = null;
    let formConfig: any = null;

    await appContext.run({ tenantId: targetTenantId }, async () => {
      try {
        const settingRows = await db.select().from(settings);
        const profileSetting = settingRows.find(
          (s: any) => s.id === "clinicProfile" || s.id === "clinic_profile" || s.key === "clinicProfile" || s.key === "clinic_profile"
        );
        if (profileSetting?.value) {
          customProfileFromSettings = typeof profileSetting.value === "string" 
            ? JSON.parse(profileSetting.value) 
            : profileSetting.value;
        }

        const configSetting = settingRows.find(
          (s: any) => s.id === "bookingFormConfig" || s.key === "bookingFormConfig"
        );
        if (configSetting?.value) {
          formConfig = typeof configSetting.value === "string" 
            ? JSON.parse(configSetting.value) 
            : configSetting.value;
        }
      } catch (err) {
        console.warn("[ClinicLookup] Error fetching tenant settings:", err);
      }
    });

    // Determine Doctor in charge:
    // 1. matchedUser.doctorName
    // 2. customProfileFromSettings.doctorName
    // 3. Active provider in providers table for this tenant
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
      } catch (e) {}
    }

    const clinicConfig: ClinicConfig = {
      clinicName: matchedUser.clinicName || customProfileFromSettings?.clinicName || customProfileFromSettings?.name || "Nha Khoa Dental Smart",
      doctorName: resolvedDoctorName,
      slogan: matchedUser.slogan || customProfileFromSettings?.slogan || "",
      address: matchedUser.address || customProfileFromSettings?.address || "",
      phone: matchedUser.phone || matchedUser.hotline || customProfileFromSettings?.phone || customProfileFromSettings?.hotline || "",
      hotline: matchedUser.hotline || matchedUser.phone || customProfileFromSettings?.hotline || customProfileFromSettings?.phone || "",
      workingHours: matchedUser.workingHoursStr || customProfileFromSettings?.workingHours || customProfileFromSettings?.workingHoursStr || "",
      workingHoursStr: matchedUser.workingHoursStr || customProfileFromSettings?.workingHoursStr || customProfileFromSettings?.workingHours || "",
      tenantId: targetTenantId,
      slug: cleanSlug,
      source: "local_db",
      bookingFormConfig: formConfig,
    };

    // Asynchronously synchronize to Firestore so Firestore contains this document
    syncClinicToFirestore(cleanSlug, clinicConfig).catch(() => {});

    return clinicConfig;
  }

  console.log(`[ClinicLookup] No clinic found for slug: "${cleanSlug}"`);
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

  try {
    const payload = {
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

    if (adminDb && typeof adminDb.collection === "function") {
      await adminDb.collection("clinics").doc(cleanSlug).set(payload, { merge: true });
      console.log(`[ClinicSync][adminDb] Synced clinic "${cleanSlug}" to Firestore 'clinics'`);
      return true;
    }

    if (serverDb) {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(serverDb, "clinics", cleanSlug), payload, { merge: true });
      console.log(`[ClinicSync][serverDb] Synced clinic "${cleanSlug}" to Firestore 'clinics'`);
      return true;
    }
  } catch (err: any) {
    console.warn(`[ClinicSync] Failed to sync clinic "${cleanSlug}" to Firestore:`, err?.message || err);
  }
  return false;
}

/**
 * Parses working hours string into structured format and checks open status
 */
export function parseBusinessHours(hoursStr?: string): BusinessHoursInfo {
  const defaultHours = "T2 - CN: 08:00 - 20:00";
  const raw = (hoursStr || "").trim() || defaultHours;
  
  // Extract time format (e.g. 08:00 - 20:00 or 8:00 - 17:00)
  const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  const openTime = timeMatch ? timeMatch[1].padStart(5, '0') : "08:00";
  const closeTime = timeMatch ? timeMatch[2].padStart(5, '0') : "20:00";

  // Check days
  let days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  if (raw.toLowerCase().includes('thứ 2 - thứ 7') || raw.toLowerCase().includes('t2 - t7')) {
    days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  } else if (raw.toLowerCase().includes('thứ 2 - thứ 6') || raw.toLowerCase().includes('t2 - t6')) {
    days = ['T2', 'T3', 'T4', 'T5', 'T6'];
  }

  // Calculate current Vietnam time (GMT+7)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vnTime = new Date(utc + (3600000 * 7));
  const currentDayIndex = vnTime.getDay(); // 0 is Sunday, 1 is Monday...
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const currentDayName = dayNames[currentDayIndex];
  
  const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes();
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpenToday = days.includes(currentDayName);
  const isCurrentlyOpen = isOpenToday && (currentMinutes >= openMinutes && currentMinutes <= closeMinutes);

  return {
    workingHoursStr: raw,
    openTime,
    closeTime,
    days,
    isOpenToday,
    isCurrentlyOpen,
    scheduleSummary: `${openTime} - ${closeTime} (${days.join(', ')})`,
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
  };

  const businessHours = parseBusinessHours(clinicConfig?.workingHoursStr || clinicConfig?.workingHours);

  let activeServices: any[] = [];
  let activeProviders: any[] = [];

  await appContext.run({ tenantId }, async () => {
    try {
      const allServices = await db.select().from(services);
      activeServices = allServices.filter((s: any) => s.isActive !== false);

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
