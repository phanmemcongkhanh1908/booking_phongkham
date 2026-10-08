import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  fetchClinicSettings,
  extractClinicIdentifier,
  ClinicBundleData,
  ClinicBrandingInfo,
  BusinessHoursInfo,
  invalidateClinicCache
} from '../services/clinicResolver';
import { useBookingStore } from '../store/booking';

export interface UseClinicSettingsResult {
  bundle: ClinicBundleData | null;
  clinicProfile: ClinicBrandingInfo | null;
  branding: ClinicBrandingInfo | null;
  businessHours: BusinessHoursInfo | null;
  services: ClinicBundleData['services'];
  providers: ClinicBundleData['providers'];
  bookingFormConfig: ClinicBundleData['bookingFormConfig'];
  announcementBanner: ClinicBundleData['announcementBanner'];
  tenantId: string | null;
  slug: string | null;
  loading: boolean;
  error: string | null;
  isCurrentlyOpen: boolean;
  refetch: () => Promise<void>;
}

export function useClinicSettings(explicitSlug?: string): UseClinicSettingsResult {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const targetIdentifier = useMemo(() => {
    if (explicitSlug && explicitSlug.trim()) {
      return explicitSlug.trim().toLowerCase();
    }
    if (routeSlug && routeSlug.trim()) {
      return routeSlug.trim().toLowerCase();
    }
    return extractClinicIdentifier(location.pathname, location.search, window.location.hostname);
  }, [explicitSlug, routeSlug, location.pathname, location.search]);

  // Initial state check from booking store if already cached
  const storeClinicProfile = useBookingStore(s => s.clinicProfile);
  const storeTenantId = useBookingStore(s => s.tenantId);

  const [bundle, setBundle] = useState<ClinicBundleData | null>(null);
  const [loading, setLoading] = useState<boolean>(!storeClinicProfile?.clinicName);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      invalidateClinicCache(targetIdentifier);
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClinicSettings(targetIdentifier);
      setBundle(data);
    } catch (err: any) {
      console.warn('[useClinicSettings] Error loading clinic settings:', err);
      setError(err?.message || 'Không thể tải thông tin phòng khám');
    } finally {
      setLoading(false);
    }
  }, [targetIdentifier]);

  useEffect(() => {
    let active = true;
    loadSettings().catch(() => {});
    return () => {
      active = false;
    };
  }, [loadSettings]);

  const clinicProfile = bundle?.clinicProfile || (storeClinicProfile as ClinicBrandingInfo) || null;
  const businessHours = bundle?.businessHours || null;
  const services = bundle?.services || [];
  const providers = bundle?.providers || [];
  const bookingFormConfig = bundle?.bookingFormConfig || null;
  const announcementBanner = bundle?.announcementBanner || null;
  const tenantId = bundle?.tenantId || storeTenantId || null;
  const slug = bundle?.slug || targetIdentifier || null;
  const isCurrentlyOpen = bundle?.businessHours?.isCurrentlyOpen ?? true;

  return {
    bundle,
    clinicProfile,
    branding: clinicProfile,
    businessHours,
    services,
    providers,
    bookingFormConfig,
    announcementBanner,
    tenantId,
    slug,
    loading,
    error,
    isCurrentlyOpen,
    refetch: () => loadSettings(true),
  };
}
