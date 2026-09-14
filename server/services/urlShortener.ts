interface ShortenResult {
  shortUrl: string;
  internalShortUrl: string;
  longUrl: string;
  provider: 'tinyurl' | 'clckru' | 'isgd' | 'internal';
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
 * Multi-tier URL Shortener:
 * 1. TinyURL (Fast, reliable, global)
 * 2. clck.ru (Backup fast external shortener)
 * 3. is.gd (Backup external shortener)
 * 4. Internal short link (/b/:slug) (Guaranteed 100% fail-safe)
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

  // Check cache
  const cacheKey = `${longUrl}_${cleanSlug}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      shortUrl: cached.shortUrl,
      internalShortUrl: cached.internalShortUrl,
      longUrl: cached.longUrl,
      provider: cached.provider,
    };
  }

  let finalShortUrl = internalShortUrl;
  let selectedProvider: ShortenResult['provider'] = 'internal';

  // Try Provider 1: TinyURL
  try {
    const res = await fetchWithTimeout(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
      3000
    );
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http')) {
        finalShortUrl = text;
        selectedProvider = 'tinyurl';
      }
    }
  } catch (err: any) {
    // TinyURL failed, proceed to next provider
  }

  // Try Provider 2: clck.ru (if TinyURL didn't succeed)
  if (selectedProvider === 'internal') {
    try {
      const res = await fetchWithTimeout(
        `https://clck.ru/--?url=${encodeURIComponent(longUrl)}`,
        { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
        3000
      );
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.startsWith('http')) {
          finalShortUrl = text;
          selectedProvider = 'clckru';
        }
      }
    } catch (err: any) {
      // clck.ru failed
    }
  }

  // Try Provider 3: is.gd (if previous didn't succeed)
  if (selectedProvider === 'internal') {
    try {
      const res = await fetchWithTimeout(
        `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`,
        { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
        2500
      );
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.startsWith('http') && !text.toLowerCase().includes('error')) {
          finalShortUrl = text;
          selectedProvider = 'isgd';
        }
      }
    } catch (err: any) {
      // is.gd failed
    }
  }

  // Final result (if all external failed, finalShortUrl is internalShortUrl, which is guaranteed 100% valid)
  const result: ShortenResult = {
    shortUrl: finalShortUrl,
    internalShortUrl,
    longUrl,
    provider: selectedProvider,
  };

  // Cache for 24 hours
  cache.set(cacheKey, {
    ...result,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return result;
}
