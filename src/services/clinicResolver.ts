import api from './api';
import { useBookingStore } from '../store/booking';

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

export interface ClinicBundleData {
  clinicProfile: ClinicBrandingInfo;
  branding: ClinicBrandingInfo;
  businessHours: BusinessHoursInfo;
  services: Array<{
    id: string;
    name: string;
    description?: string;
    durationMins?: number;
    price?: number | null;
    showPrice?: boolean;
    isHot?: boolean;
    isFree?: boolean;
    isActive?: boolean;
  }>;
  providers: Array<{
    id: string;
    name: string;
    specialty?: string;
    experience?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
  bookingFormConfig: {
    uiVersion?: 'full' | 'simple';
    showNotificationChannels?: boolean;
    showHoldCountdown?: boolean;
    quickNotesTags?: string[];
  } | null;
  announcementBanner: {
    isVisible: boolean;
    message: string;
    type: 'info' | 'warning' | 'success';
  } | null;
  telegramBotUsername: string | null;
  tenantId: string | null;
  slug: string | null;
  source?: string;
}

// In-memory cache for fast sub-millisecond retrieval during client navigation
const memoryCache = new Map<string, { data: ClinicBundleData; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-flight promise deduplication map to prevent waterfall/duplicate requests
const inFlightRequests = new Map<string, Promise<ClinicBundleData>>();

/**
 * Extracts clinic slug from URL path, query params, or subdomain
 */
export function extractClinicIdentifier(
  pathname: string = window.location.pathname,
  search: string = window.location.search,
  hostname: string = window.location.hostname
): string {
  // 1. Check URL Path (/b/:slug/*, /booking/:slug/*, /s/:slug/*)
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    const prefix = pathParts[0].toLowerCase();
    if (['b', 'booking', 's'].includes(prefix)) {
      const candidateSlug = pathParts[1].toLowerCase();
      // Ignore static sub-actions like 'login', 'admin', 'dich-vu' if they happen to be in index 1
      if (!['login', 'admin', 'dich-vu', 'chon-gio', 'thong-tin', 'xac-nhan'].includes(candidateSlug)) {
        return candidateSlug;
      }
    }
  }

  // 2. Check Query Parameters (?clinic=..., ?slug=..., ?s=...)
  const params = new URLSearchParams(search);
  const querySlug = params.get('clinic') || params.get('slug') || params.get('s');
  if (querySlug && querySlug.trim()) {
    return querySlug.trim().toLowerCase();
  }

  // 3. Check Subdomain (e.g. lephuong.phongkham.vn or lephuong.localhost)
  const cleanHost = hostname.split(':')[0].toLowerCase();
  const hostParts = cleanHost.split('.');
  if (hostParts.length === 2 && hostParts[1] === 'localhost') {
    return hostParts[0];
  }
  if (hostParts.length >= 3) {
    const sub = hostParts[0];
    const reserved = ['www', 'api', 'app', 'dev', 'stage', 'preview', 'admin', 'auth', 'mail', 'static'];
    if (!reserved.includes(sub) && !sub.startsWith('ais-dev-') && !sub.startsWith('ais-pre-') && !sub.startsWith('ais-app-') && !sub.includes('run.app')) {
      return sub;
    }
  }

  // 4. Fallback to localStorage last visited clinic if available
  const storedSlug = localStorage.getItem('last_clinic_slug');
  if (storedSlug && storedSlug.trim()) {
    return storedSlug.trim().toLowerCase();
  }

  return '';
}

/**
 * High-performance service layer function for resolving full clinic bundle
 */
export async function fetchClinicSettings(slugOrDomain?: string): Promise<ClinicBundleData> {
  const effectiveIdentifier = (slugOrDomain !== undefined ? slugOrDomain : extractClinicIdentifier()).trim().toLowerCase();
  const cacheKey = effectiveIdentifier || '__default_root__';

  // 1. Check in-memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Check sessionStorage cache
  try {
    const sessionRaw = sessionStorage.getItem(`clinic_bundle_${cacheKey}`);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && Date.now() - (parsed._cachedAt || 0) < CACHE_TTL_MS) {
        delete parsed._cachedAt;
        memoryCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Deduplicate concurrent in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const endpoint = effectiveIdentifier
        ? `/public/clinic-bundle/${encodeURIComponent(effectiveIdentifier)}`
        : '/public/clinic-bundle';

      let res;
      try {
        res = await api.get(endpoint);
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 500) {
          const fallbackEndpoint = effectiveIdentifier
            ? `/public/clinic-info/${encodeURIComponent(effectiveIdentifier)}`
            : '/public/clinic-info';
          res = await api.get(fallbackEndpoint);
        } else {
          throw err;
        }
      }

      if (!res?.data?.success || !res?.data?.data) {
        throw new Error('Không thể tải cấu hình phòng khám');
      }

      const bundle: ClinicBundleData = res.data.data;

      // Update caches
      memoryCache.set(cacheKey, { data: bundle, timestamp: Date.now() });
      try {
        sessionStorage.setItem(
          `clinic_bundle_${cacheKey}`,
          JSON.stringify({ ...bundle, _cachedAt: Date.now() })
        );
      } catch (e) {}

      // Automatically sync into booking store and local storage
      if (bundle.slug) {
        localStorage.setItem('last_clinic_slug', bundle.slug);
      }
      if (bundle.tenantId) {
        useBookingStore.getState().setTenantId(bundle.tenantId);
      }
      if (bundle.clinicProfile) {
        useBookingStore.getState().setClinicProfile(bundle.clinicProfile);
      }
      if (bundle.bookingFormConfig) {
        useBookingStore.getState().setBookingFormConfig(bundle.bookingFormConfig);
      }
      if (bundle.announcementBanner) {
        useBookingStore.getState().setAnnouncementBanner(bundle.announcementBanner);
      }

      // Apply dynamic DOM branding (Title, Colors)
      applyClinicBrandingToDOM(bundle);

      return bundle;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Injects custom clinic branding into document title and CSS variables
 */
export function applyClinicBrandingToDOM(bundle: ClinicBundleData): void {
  const profile = bundle.clinicProfile;
  if (!profile) return;

  // 1. Dynamic Title
  const clinicName = profile.clinicName || profile.name || 'Dental Smart Clinic';
  const doctorName = profile.doctorName ? (
    profile.doctorName.startsWith('Bs') || profile.doctorName.startsWith('BS')
      ? profile.doctorName
      : `BS. ${profile.doctorName}`
  ) : '';

  if (doctorName) {
    document.title = `${clinicName} - ${doctorName} | Đặt lịch khám trực tuyến`;
  } else {
    document.title = `${clinicName} | Đặt lịch khám trực tuyến`;
  }

  // 2. Dynamic Theme Colors via CSS Custom Properties
  if (bundle.branding?.primaryColor) {
    document.documentElement.style.setProperty('--clinic-primary', bundle.branding.primaryColor);
  }
  if (bundle.branding?.accentColor) {
    document.documentElement.style.setProperty('--clinic-accent', bundle.branding.accentColor);
  }
}

/**
 * Clears cache for a given clinic (e.g. after updating settings in Admin)
 */
export function invalidateClinicCache(slug?: string): void {
  if (slug) {
    const key = slug.trim().toLowerCase();
    memoryCache.delete(key);
    try {
      sessionStorage.removeItem(`clinic_bundle_${key}`);
    } catch (e) {}
  } else {
    memoryCache.clear();
  }
}

/**
 * Resolves the URL base path according to current route prefix (/b/:slug, /booking/:slug, /s/:slug)
 */
export function getClinicBasePath(
  slug?: string | null,
  currentPathname: string = typeof window !== 'undefined' ? window.location.pathname : ''
): string {
  if (!slug || !slug.trim()) return '/book';
  const cleanSlug = slug.trim().toLowerCase();
  const pathParts = currentPathname.split('/').filter(Boolean);
  const prefix = pathParts[0] === 'b' ? 'b' : pathParts[0] === 's' ? 's' : 'booking';
  return `/${prefix}/${cleanSlug}`;
}

