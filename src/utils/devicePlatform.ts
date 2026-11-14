export type DeviceOS = 'windows' | 'macos' | 'ios' | 'android' | 'linux';
export type DeviceBrowser = 'edge' | 'chrome' | 'coccoc' | 'samsung' | 'safari' | 'firefox' | 'other';

export interface DevicePlatformInfo {
  os: DeviceOS;
  browser: DeviceBrowser;
  isIOS: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isStandalone: boolean;
  isInIframe: boolean;
  supportsVibration: boolean;
  osLabel: string;
  browserLabel: string;
  deviceLabel: string;
}

export function detectDevicePlatform(): DevicePlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'windows',
      browser: 'chrome',
      isIOS: false,
      isAndroid: false,
      isWindows: true,
      isMacOS: false,
      isMobile: false,
      isDesktop: true,
      isStandalone: false,
      isInIframe: false,
      supportsVibration: false,
      osLabel: 'Máy tính',
      browserLabel: 'Trình duyệt',
      deviceLabel: 'Máy tính',
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // Detect iOS / iPadOS (modern iPads report Macintosh + maxTouchPoints > 1)
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (platform.includes('mac') && maxTouchPoints > 1) ||
    (/macintosh/.test(ua) && maxTouchPoints > 1);
  const isAndroid = !isIOS && /android/.test(ua);
  const isWindows = !isIOS && !isAndroid && (/win/.test(ua) || /win/.test(platform));
  const isMacOS = !isIOS && !isAndroid && !isWindows && (/mac/.test(ua) || /mac/.test(platform));

  const os: DeviceOS = isIOS
    ? 'ios'
    : isAndroid
    ? 'android'
    : isWindows
    ? 'windows'
    : isMacOS
    ? 'macos'
    : 'linux';

  let browser: DeviceBrowser = 'other';
  if (/coc_coc_browser/.test(ua)) browser = 'coccoc';
  else if (/edg\//.test(ua) || /edga\//.test(ua) || /edgios\//.test(ua)) browser = 'edge';
  else if (/samsungbrowser/.test(ua)) browser = 'samsung';
  else if (/firefox|fxios/.test(ua)) browser = 'firefox';
  else if (/chrome|crios|chromium/.test(ua)) browser = 'chrome';
  else if (/safari/.test(ua)) browser = 'safari';

  const isMobile = isIOS || isAndroid;
  const isDesktop = !isMobile;

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (window.navigator as any).standalone === true;

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  const supportsVibration =
    isAndroid && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  const osLabel =
    os === 'ios'
      ? /ipad/.test(ua)
        ? 'iPad'
        : 'iPhone'
      : os === 'android'
      ? 'Android'
      : os === 'windows'
      ? 'Windows'
      : os === 'macos'
      ? 'macOS'
      : 'Linux';

  const browserLabel =
    browser === 'edge'
      ? 'Edge'
      : browser === 'chrome'
      ? 'Chrome'
      : browser === 'coccoc'
      ? 'Cốc Cốc'
      : browser === 'samsung'
      ? 'Samsung Internet'
      : browser === 'safari'
      ? 'Safari'
      : browser === 'firefox'
      ? 'Firefox'
      : 'Trình duyệt';

  const deviceLabel = isMobile
    ? `${os === 'ios' ? osLabel : `Điện thoại ${osLabel}`} · ${browserLabel}`
    : `Máy tính ${osLabel} · ${browserLabel}`;

  return {
    os,
    browser,
    isIOS,
    isAndroid,
    isWindows,
    isMacOS,
    isMobile,
    isDesktop,
    isStandalone,
    isInIframe,
    supportsVibration,
    osLabel,
    browserLabel,
    deviceLabel,
  };
}
