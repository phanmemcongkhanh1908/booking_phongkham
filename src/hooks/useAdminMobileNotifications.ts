import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/auth';
import { useBroadcastStore } from '../store/broadcastStore';
import { usePWAInstall } from './usePWAInstall';
import toast from 'react-hot-toast';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Thiết bị quản trị';
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return 'iPhone (Quản trị)';
  if (/ipad/i.test(ua)) return 'iPad (Quản trị)';
  if (/android/i.test(ua)) return 'Điện thoại Android (Quản trị)';
  if (/mac/i.test(ua)) return 'MacBook / iMac';
  if (/windows/i.test(ua)) return 'Máy tính Windows';
  return 'Trình duyệt Quản trị';
}

/**
 * Swaps <link rel="manifest"> and apple-mobile meta tags to the Clinic Admin launcher
 * while the user is inside /admin/* or a clinic's login route.
 */
export function useAdminManifestBinding(clinicSlug?: string | null, clinicName?: string | null) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prevHref = manifestLink?.getAttribute('href') || '/manifest.webmanifest';
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const prevAppleTitle = appleTitleMeta?.getAttribute('content') || 'DentalApp';

    const params = new URLSearchParams();
    if (clinicSlug) params.set('slug', clinicSlug);
    if (clinicName) params.set('name', clinicName);
    const adminManifestHref = `/api/public/admin-manifest.webmanifest${params.toString() ? `?${params.toString()}` : ''}`;

    if (manifestLink) {
      manifestLink.setAttribute('href', adminManifestHref);
    }
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', 'Quản Lý PK');
    }

    if (clinicSlug) {
      localStorage.setItem('last_admin_slug', clinicSlug);
    }

    return () => {
      if (manifestLink) {
        manifestLink.setAttribute('href', prevHref);
      }
      if (appleTitleMeta) {
        appleTitleMeta.setAttribute('content', prevAppleTitle);
      }
    };
  }, [clinicSlug, clinicName]);
}

export function useAdminMobileNotifications() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const pwa = usePWAInstall();

  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  const checkStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setIsInIframe(window.self !== window.top);

    const hasNotification = 'Notification' in window;
    setPermissionState(hasNotification ? Notification.permission : 'unsupported');

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && hasNotification;
    setIsPushSupported(supported);

    if (!supported) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setIsPushSubscribed(true);
        setCurrentEndpoint(sub.endpoint);
      } else {
        setIsPushSubscribed(false);
        setCurrentEndpoint(null);
      }
    } catch {
      setIsPushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Silently re-sync existing subscription to backend whenever logged-in user/tenant changes
  useEffect(() => {
    if (!token || !user || !isPushSubscribed) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const bState = useBroadcastStore.getState();
        await api.post('/notifications/admin/subscribe', {
          subscription: sub.toJSON(),
          deviceLabel: getDeviceLabel(),
          notifyPopup: bState.mobilePopupEnabled,
          notifySound: bState.enabled,
        });
      } catch {}
    })();
  }, [token, user?.id, user?.tenantId, isPushSubscribed]);

  // iOS Safari only supports Web Push when added to Home Screen (standalone mode)
  const needsIOSHomeScreenInstall = pwa.isIOS && !pwa.isInstalled;

  const enableMobilePush = async (): Promise<{ ok: boolean; reason?: 'ios_install_required' | 'iframe' | 'denied' | 'error' }> => {
    if (needsIOSHomeScreenInstall) {
      return { ok: false, reason: 'ios_install_required' };
    }
    if (isInIframe && permissionState !== 'granted') {
      return { ok: false, reason: 'iframe' };
    }
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Trình duyệt hiện tại không hỗ trợ thông báo đẩy Web Push.');
      return { ok: false, reason: 'error' };
    }
    if (Notification.permission === 'denied') {
      setPermissionState('denied');
      return { ok: false, reason: 'denied' };
    }

    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm !== 'granted') {
        return { ok: false, reason: 'denied' };
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidRes = await api.get('/notifications/vapid-key');
      const publicKey = vapidRes.data?.publicKey;
      if (!publicKey) throw new Error('Thiếu VAPID public key');

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const bState = useBroadcastStore.getState();
      await api.post('/notifications/admin/subscribe', {
        subscription: sub.toJSON(),
        deviceLabel: getDeviceLabel(),
        notifyPopup: bState.mobilePopupEnabled,
        notifySound: bState.enabled,
      });

      setIsPushSubscribed(true);
      setCurrentEndpoint(sub.endpoint);
      toast.success('Đã bật thông báo đẩy trên thiết bị! Bạn sẽ nhận popup ngay cả khi tắt màn hình.', {
        icon: '📱',
      });
      return { ok: true };
    } catch (err: any) {
      console.error('Enable mobile admin push failed:', err);
      toast.error(err?.response?.data?.error?.message || 'Không thể bật thông báo đẩy trên thiết bị này.');
      return { ok: false, reason: 'error' };
    } finally {
      setSubscribing(false);
    }
  };

  const disableMobilePush = async () => {
    setSubscribing(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const ep = sub.endpoint;
          await sub.unsubscribe().catch(() => {});
          await api.post('/notifications/admin/unsubscribe', { endpoint: ep }).catch(() => {});
        }
      }
      setIsPushSubscribed(false);
      setCurrentEndpoint(null);
      toast.success('Đã tắt thông báo đẩy trên thiết bị này.');
    } finally {
      setSubscribing(false);
    }
  };

  const sendTestMobilePush = async () => {
    if (!isPushSubscribed) {
      toast.error('Vui lòng bật Thông báo đẩy trước khi gửi thử.');
      return;
    }
    setTestingPush(true);
    try {
      await api.post('/notifications/admin/test-push', {
        endpoint: currentEndpoint || undefined,
      });
      toast.success('Đã gửi thông báo đẩy thử nghiệm tới thiết bị này!', { icon: '🔔' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Không thể gửi thông báo thử nghiệm.');
    } finally {
      setTestingPush(false);
    }
  };

  const installAdminApp = async () => {
    localStorage.setItem('pwa_admin_mode', '1');
    if (user?.slug) {
      localStorage.setItem('last_admin_slug', user.slug);
    }
    if (pwa.isInstallable) {
      const accepted = await pwa.install();
      if (accepted) {
        toast.success('Đã cài Ứng dụng Quản Trị ra màn hình chính!', { icon: '📲' });
        return { installed: true };
      }
    }
    return { installed: false };
  };

  return {
    ...pwa,
    isPushSupported,
    isPushSubscribed,
    permissionState,
    needsIOSHomeScreenInstall,
    isInIframe,
    subscribing,
    testingPush,
    checkStatus,
    enableMobilePush,
    disableMobilePush,
    sendTestMobilePush,
    installAdminApp,
  };
}
