import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isPC: boolean;
  isInAppBrowser: boolean;
  isIOSSafari: boolean;
}

export function detectPlatformInfo(): PlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIOS: false, isAndroid: false, isPC: true, isInAppBrowser: false, isIOSSafari: false };
  }
  const ua = window.navigator.userAgent || '';
  const uaLower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(uaLower) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(uaLower);
  const isPC = !isIOS && !isAndroid;
  const isInAppBrowser = /zalo|fban|fbav|fb_iab|messenger|instagram|line\/|micromessenger|musical_ly|bytedancewebview/i.test(ua);
  const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua) && !isInAppBrowser;

  return { isIOS, isAndroid, isPC, isInAppBrowser, isIOSSafari };
}

function toAsciiSafeName(name: string): string {
  const cleaned = (name || 'Dat_Lich_Kham')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 50) || 'Dat_Lich_Kham';
}

function buildClinicShortTitle(rawName: string): string {
  const cleaned = rawName.replace(/^nha\s+khoa\s+/i, '').trim() || rawName.trim();
  if (!cleaned) return 'Đặt Lịch';
  if (cleaned.length <= 12) return cleaned;
  const words = cleaned.split(/\s+/);
  let acc = '';
  for (const w of words) {
    const next = acc ? `${acc} ${w}` : w;
    if (next.length <= 12) acc = next;
    else break;
  }
  return acc || cleaned.slice(0, 12);
}

/**
 * Dynamically binds <link rel="manifest"> and apple-mobile-web-app-title
 * on public clinic booking pages (/b/:slug, /booking/:slug) so Android/iOS/PC
 * install the exact clinic app name and start_url.
 */
export function useClinicManifestBinding(clinicSlug?: string | null, clinicName?: string | null) {
  useEffect(() => {
    if (typeof document === 'undefined' || !clinicSlug) return;

    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prevHref = manifestLink?.getAttribute('href') || '/manifest.webmanifest';
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const prevAppleTitle = appleTitleMeta?.getAttribute('content') || 'DentalApp';

    const params = new URLSearchParams();
    params.set('slug', clinicSlug.trim());
    if (clinicName && clinicName.trim()) {
      params.set('name', clinicName.trim());
    }
    const clinicManifestHref = `/api/public/clinic-manifest.webmanifest?${params.toString()}`;

    if (manifestLink) {
      manifestLink.setAttribute('href', clinicManifestHref);
    }
    if (appleTitleMeta && clinicName) {
      appleTitleMeta.setAttribute('content', buildClinicShortTitle(clinicName));
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

function reportPwaInstall(displayMode: 'standalone' | 'shortcut') {
  try {
    const { isIOS, isAndroid } = detectPlatformInfo();
    const platformStr = isIOS ? 'ios' : isAndroid ? 'android' : 'pc';
    fetch('/api/public/pwa-install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: platformStr,
        displayMode,
        installedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {}
}

export function usePWAInstall() {
  const initialPlatform = detectPlatformInfo();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__deferredPwaPrompt) {
      return (window as any).__deferredPwaPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });
  const [platform] = useState<PlatformInfo>(initialPlatform);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Sync deferred prompt if captured before mount
    if ((window as any).__deferredPwaPrompt) {
      setDeferredPrompt((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent);
    }

    // Auto-report install if running standalone
    if (isStandalone && !localStorage.getItem('pwa_install_reported')) {
      reportPwaInstall('standalone');
      localStorage.setItem('pwa_install_reported', 'true');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handlePromptReady = () => {
      if ((window as any).__deferredPwaPrompt) {
        setDeferredPrompt((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredPwaPrompt = null;
      const isAdminPath =
        window.location.pathname.startsWith('/admin') ||
        window.location.pathname.endsWith('/login');
      if (isAdminPath) {
        localStorage.setItem('pwa_admin_mode', '1');
      } else {
        localStorage.removeItem('pwa_admin_mode');
      }
      reportPwaInstall('standalone');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-installprompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-installprompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const promptObj = deferredPrompt || ((window as any).__deferredPwaPrompt as BeforeInstallPromptEvent | null);
    if (!promptObj) return false;
    await promptObj.prompt();
    const { outcome } = await promptObj.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredPwaPrompt = null;
      const isAdminPath =
        window.location.pathname.startsWith('/admin') ||
        window.location.pathname.endsWith('/login');
      if (isAdminPath) {
        localStorage.setItem('pwa_admin_mode', '1');
      } else {
        localStorage.removeItem('pwa_admin_mode');
      }
      reportPwaInstall('standalone');
      return true;
    }
    return false;
  };

  /**
   * Modern PC Desktop Launcher (.html):
   * Uses File System Access API (`showSaveFilePicker({ startIn: 'desktop' })`) on Chrome/Edge/CocCoc
   * so the user saves straight onto Desktop with ZERO `.download` or SmartScreen blocking.
   */
  const saveHtmlDesktopLauncher = async (
    clinicName = 'Dat_Lich_Kham'
  ): Promise<{ ok: boolean; method: 'picker' | 'download' | 'cancelled' }> => {
    try {
      const targetUrl = window.location.href;
      const safeTitle = (clinicName || 'Đặt Lịch Phòng Khám').replace(/[<>&"]/g, '');
      const asciiName = toAsciiSafeName(clinicName);
      const htmlContent = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <meta http-equiv="refresh" content="0;url=${targetUrl}" />
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}
    .card{background:#fff;padding:28px 32px;border-radius:16px;border:1px solid #e2e8f0;text-align:center;max-width:380px;box-shadow:0 10px 25px rgba(15,23,42,.06)}
    a{display:inline-block;margin-top:14px;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px}
  </style>
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 8px;font-size:18px">${safeTitle}</h2>
    <p style="margin:0;font-size:13px;color:#475569">Đang mở trang đặt lịch phòng khám...</p>
    <a href="${targetUrl}">Mở ngay</a>
  </div>
</body>
</html>`;

      // Prefer modern File System Access API pointing directly to Desktop
      if (typeof (window as any).showSaveFilePicker === 'function') {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${asciiName}.html`,
            startIn: 'desktop',
            types: [
              {
                description: 'Lối tắt Mở nhanh Phòng khám (.html)',
                accept: { 'text/html': ['.html'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(htmlContent);
          await writable.close();
          reportPwaInstall('shortcut');
          return { ok: true, method: 'picker' };
        } catch (pickerErr: any) {
          if (pickerErr?.name === 'AbortError') {
            return { ok: false, method: 'cancelled' };
          }
          // Fall through to standard HTML download on unsupported OS/context
        }
      }

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${asciiName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke so browser download manager completes cleanly
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
      reportPwaInstall('shortcut');
      return { ok: true, method: 'download' };
    } catch (e) {
      console.error('Error creating HTML desktop launcher:', e);
      return { ok: false, method: 'download' };
    }
  };

  /**
   * Downloads server-generated Windows .bat script that automatically creates a native .lnk
   * shortcut with clinic icon directly on the Windows Desktop (including OneDrive Desktop).
   */
  const downloadBatAutoShortcutScript = (clinicName = 'Dat_Lich_Kham'): boolean => {
    try {
      const targetUrl = window.location.href;
      const endpoint = `/api/public/pc-shortcut-script?url=${encodeURIComponent(targetUrl)}&name=${encodeURIComponent(clinicName)}`;
      const a = document.createElement('a');
      a.href = endpoint;
      a.download = `Cai_Dat_${toAsciiSafeName(clinicName)}.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      reportPwaInstall('shortcut');
      return true;
    } catch (e) {
      console.error('Error downloading .bat shortcut script:', e);
      return false;
    }
  };

  /**
   * Builds a safe 1-line PowerShell command for Win + R (creates native Desktop .lnk without downloading any file).
   */
  const getQuickPowerShellCommand = (clinicName = 'Dat Lich Phong Kham'): string => {
    const targetUrl = typeof window !== 'undefined' ? window.location.href : '';
    const displayTitle = (clinicName || 'Dat Lich Phong Kham')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50) || 'Dat Lich Phong Kham';
    const psEsc = (s: string) => s.replace(/'/g, "''");
    return `powershell -NoP -W Hidden -C "$d=[Environment]::GetFolderPath('Desktop');$w=New-Object -Com WScript.Shell;$s=$w.CreateShortcut(\"$d\\${psEsc(displayTitle)}.lnk\");$s.TargetPath='${psEsc(targetUrl)}';$s.Save()"`;
  };

  /**
   * Builds clean share/QR URL that signals Android Chrome to prioritize app installation.
   */
  const getAndroidInstallQrUrl = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('highlightAppointmentId');
      url.searchParams.delete('status');
      url.searchParams.set('install', 'android');
      return url.toString();
    } catch {
      return window.location.href;
    }
  };

  /**
   * Escapes Zalo / Facebook / Messenger In-App Browsers directly into Google Chrome on Android
   * using Android's native intent:// URI scheme.
   */
  const openInAndroidChrome = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const targetUrl = new URL(getAndroidInstallQrUrl());
      const scheme = targetUrl.protocol.replace(':', '') || 'https';
      const hostAndPath = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}`;
      const intentUri = `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(targetUrl.toString())};end`;
      window.location.href = intentUri;
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Downloads Google Bubblewrap TWA APK packager script (.bat) for Windows
   * to compile & cryptographically sign a real app-release-signed.apk.
   */
  const downloadAndroidApkBuilderScript = (
    clinicName = 'Dental_Smart',
    clinicSlug = '',
    customPackageId = ''
  ): boolean => {
    try {
      const targetUrl = typeof window !== 'undefined' ? window.location.href : '';
      const params = new URLSearchParams({
        url: targetUrl,
        name: clinicName,
      });
      if (clinicSlug) params.set('slug', clinicSlug);
      if (customPackageId) params.set('pkg', customPackageId);
      const endpoint = `/api/public/android-apk-builder?${params.toString()}`;
      const a = document.createElement('a');
      a.href = endpoint;
      a.download = `Dong_Goi_APK_${toAsciiSafeName(clinicName)}.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error('Error downloading Android APK builder script:', e);
      return false;
    }
  };

  /**
   * Downloads Bubblewrap twa-manifest.json pre-configured for the clinic.
   */
  const downloadAndroidTwaManifest = (
    clinicName = 'Dental_Smart',
    clinicSlug = '',
    customPackageId = ''
  ): boolean => {
    try {
      const targetUrl = typeof window !== 'undefined' ? window.location.href : '';
      const params = new URLSearchParams({
        url: targetUrl,
        name: clinicName,
      });
      if (clinicSlug) params.set('slug', clinicSlug);
      if (customPackageId) params.set('pkg', customPackageId);
      const endpoint = `/api/public/android-twa-manifest?${params.toString()}`;
      const a = document.createElement('a');
      a.href = endpoint;
      a.download = 'twa-manifest.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error('Error downloading twa-manifest.json:', e);
      return false;
    }
  };

  const isInstallRequestedFromUrl =
    typeof window !== 'undefined' &&
    ['android', 'app', '1', 'true'].includes(
      (new URLSearchParams(window.location.search).get('install') || '').toLowerCase()
    );

  // Backwards-compatible wrapper
  const createDesktopShortcut = async (clinicName = 'Dat_Lich_Kham') => {
    const res = await saveHtmlDesktopLauncher(clinicName);
    return res.ok;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: platform.isIOS,
    isAndroid: platform.isAndroid,
    isPC: platform.isPC,
    isInAppBrowser: platform.isInAppBrowser,
    isIOSSafari: platform.isIOSSafari,
    isInstallRequestedFromUrl,
    supportsFilePicker: typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function',
    install,
    saveHtmlDesktopLauncher,
    downloadBatAutoShortcutScript,
    getQuickPowerShellCommand,
    getAndroidInstallQrUrl,
    openInAndroidChrome,
    downloadAndroidApkBuilderScript,
    downloadAndroidTwaManifest,
    createDesktopShortcut,
  };
}
