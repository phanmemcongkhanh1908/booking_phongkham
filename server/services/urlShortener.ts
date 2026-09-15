export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
  error?: string; // Bổ sung cờ báo lỗi nếu link này bị trùng lặp trên mạng toàn cầu
}

export interface ShortenResult {
  shortUrl: string;
  internalShortUrl: string;
  longUrl: string;
  provider: string;
  options: ShortLinkOption[];
}

interface CacheEntry extends ShortenResult {
  expiresAt: number;
}

// In-memory cache for 24 hours
const cache = new Map<string, CacheEntry>();

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Multi-provider Zero-Ad URL Shortener & Link Generator
 * Strictly provides DIRECT REDIRECTS with 100% NO ADVERTISEMENTS.
 */
export async function shortenUrl(longUrl: string, slug?: string, origin?: string): Promise<ShortenResult> {
  // Extract or build internal short URL
  let detectedOrigin = origin || '';
  if (!detectedOrigin && longUrl.startsWith('http')) {
    try {
      const parsed = new URL(longUrl);
      detectedOrigin = parsed.origin;
    } catch {
      // Ignore
    }
  }

  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const internalShortUrl = cleanSlug && detectedOrigin ? `${detectedOrigin}/b/${cleanSlug}` : longUrl;
  const fullBookingUrl = cleanSlug && detectedOrigin ? `${detectedOrigin}/booking/${cleanSlug}` : longUrl;

  // Check cache
  const cacheKey = `${longUrl}_${cleanSlug}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      shortUrl: cached.shortUrl,
      internalShortUrl: cached.internalShortUrl,
      longUrl: cached.longUrl,
      provider: cached.provider,
      options: cached.options,
    };
  }

  // Generate external clean ad-free short links in parallel
  const [tinyUrlRes, dagdRes] = await Promise.allSettled([
    // 1. TinyURL (Direct 301 redirect, zero ads) with custom alias
    (async () => {
      // Helper function to test an alias
      const tryTiny = async (alias) => {
        const res = await fetchWithTimeout(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullBookingUrl)}&alias=${encodeURIComponent(alias)}`,
          { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
          3000
        );
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http')) return text;
        }
        return null;
      };

      let result = await tryTiny(cleanSlug);
      if (result) return { url: result, error: null };
      
      // Fallback 1
      result = await tryTiny(cleanSlug + '-vn');
      if (result) return { url: result, error: null };
      
      // Fallback 2
      result = await tryTiny(cleanSlug + '-booking');
      if (result) return { url: result, error: null };

      return { url: '', error: 'Tên định danh này đã có người khác sử dụng trên toàn cầu' };
    })(),

    // 2. da.gd (Open source, direct 302 redirect, zero ads) with custom shorturl
    (async () => {
      if (cleanSlug.length > 10) return { url: '', error: 'Tên quá dài so với quy định của da.gd (tối đa 10 ký tự)' };
      
      const tryDagd = async (alias) => {
        if (alias.length > 10) return null; // da.gd strictly limits to 10
        const res = await fetchWithTimeout(
          `https://da.gd/s?url=${encodeURIComponent(fullBookingUrl)}&shorturl=${encodeURIComponent(alias)}`,
          { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
          3000
        );
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http') && !text.toLowerCase().includes('error')) return text;
        }
        return null;
      };

      let result = await tryDagd(cleanSlug);
      if (result) return { url: result, error: null };
      
      // Fallback for da.gd if length permits
      if ((cleanSlug + '-vn').length <= 10) {
        result = await tryDagd(cleanSlug + '-vn');
        if (result) return { url: result, error: null };
      }

      return { url: '', error: 'Tên định danh đã bị trùng lặp' };
    })(),
  ]);

  const tinyData = tinyUrlRes.status === 'fulfilled' ? tinyUrlRes.value : { url: '', error: 'Lỗi kết nối máy chủ TinyURL' };
  const dagdData = dagdRes.status === 'fulfilled' ? dagdRes.value : { url: '', error: 'Lỗi kết nối máy chủ da.gd' };
  
  const renderDomainUrl = `https://booking-phongkham.onrender.com/b/${cleanSlug}`;

  let options: ShortLinkOption[] = [
    {
      id: 'internal',
      name: 'Link phòng khám (Hiện tại)',
      tagline: 'Tên miền đang truy cập • 100% Không quảng cáo',
      url: internalShortUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    },
    {
      id: 'render',
      name: 'Link máy chủ (Gốc)',
      tagline: 'Tên miền chính thức booking-phongkham.onrender.com',
      url: renderDomainUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    }
  ];

  
  options.push({
    id: 'dagd',
    name: 'da.gd (Siêu ngắn)',
    tagline: 'Mã nguồn mở • 302 Chuyển hướng tức thì',
    url: dagdData.url || 'https://da.gd/...',
    isAdFree: true,
    isDirectRedirect: true,
    type: 'short',
    error: dagdData.error || undefined
  });

  options.push({
    id: 'tinyurl',
    name: 'TinyURL (Toàn cầu)',
    tagline: 'Dịch vụ uy tín từ 2002 • 301 Chuyển hướng trực tiếp',
    url: tinyData.url || 'https://tinyurl.com/...',
    isAdFree: true,
    isDirectRedirect: true,
    type: 'short',
    error: tinyData.error || undefined
  });

  // Deduplicate by URL (keeps first occurrence, effectively prioritizing 'internal' over 'render' if they match)
  const seenUrls = new Set<string>();
  options = options.filter(opt => {
    // Strip http/https for comparison to be safe
    const urlNormalized = opt.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (seenUrls.has(urlNormalized)) {
      return false;
    }
    seenUrls.add(urlNormalized);
    return true;
  });

  // Default short link priority: internal -> tinyurl -> dagd -> full
  const primaryShortUrl = internalShortUrl;
  const primaryProvider = 'internal';

  const result: ShortenResult = {
    shortUrl: primaryShortUrl,
    internalShortUrl,
    longUrl,
    provider: primaryProvider,
    options,
  };

  // Cache for 24 hours
  cache.set(cacheKey, {
    ...result,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return result;
}


// Cleanup expired cache entries periodically (Memory Leak Prevention)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Check every 1 hour
