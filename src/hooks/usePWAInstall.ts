import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isPC, setIsPC] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isPCDevice = !isIOSDevice && !isAndroidDevice;

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsPC(isPCDevice);

    // Auto-report install if running standalone
    if (isStandalone && !localStorage.getItem('pwa_install_reported')) {
      const platformStr = isIOSDevice ? 'ios' : isAndroidDevice ? 'android' : 'pc';
      fetch('/api/public/pwa-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformStr,
          displayMode: 'standalone',
          installedAt: new Date().toISOString()
        })
      }).then(() => {
        localStorage.setItem('pwa_install_reported', 'true');
      }).catch(() => {});
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      const isAdminPath =
        window.location.pathname.startsWith('/admin') ||
        window.location.pathname.endsWith('/login');
      if (isAdminPath) {
        localStorage.setItem('pwa_admin_mode', '1');
      } else {
        localStorage.removeItem('pwa_admin_mode');
      }
      const platformStr = isIOSDevice ? 'ios' : isAndroidDevice ? 'android' : 'pc';
      fetch('/api/public/pwa-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformStr,
          displayMode: 'standalone',
          installedAt: new Date().toISOString()
        })
      }).catch(() => {});
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      const isAdminPath =
        window.location.pathname.startsWith('/admin') ||
        window.location.pathname.endsWith('/login');
      if (isAdminPath) {
        localStorage.setItem('pwa_admin_mode', '1');
      } else {
        localStorage.removeItem('pwa_admin_mode');
      }
      const userAgent = window.navigator.userAgent.toLowerCase();
      const platformStr = /iphone|ipad|ipod/.test(userAgent) ? 'ios' : /android/.test(userAgent) ? 'android' : 'pc';
      fetch('/api/public/pwa-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformStr,
          displayMode: 'standalone',
          installedAt: new Date().toISOString()
        })
      }).catch(() => {});
      return true;
    }
    return false;
  };

  const createDesktopShortcut = (clinicName = 'Dat_Lich_Kham') => {
    try {
      const targetUrl = window.location.href;
      const fileContent = `[InternetShortcut]\nURL=${targetUrl}\nIconIndex=0\nIconFile=${window.location.origin}/icon.svg\nHotKey=0\n[{000214A0-0000-0000-C000-000000000046}]\nProp3=19,11\n`;
      const blob = new Blob([fileContent], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeName = clinicName.replace(/[^\w\d\s-_À-ỹ]/gi, '').trim().replace(/\s+/g, '_') || 'Dat_Lich_Kham';
      a.download = `${safeName}.url`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Report shortcut creation as install metric
      fetch('/api/public/pwa-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'pc',
          displayMode: 'shortcut',
          installedAt: new Date().toISOString()
        })
      }).catch(() => {});

      return true;
    } catch (e) {
      console.error('Error creating desktop shortcut:', e);
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isPC,
    install,
    createDesktopShortcut,
  };
}
