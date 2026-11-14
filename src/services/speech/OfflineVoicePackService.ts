export interface OfflinePackMetadata {
  installed: boolean;
  version: string;
  keys: string[];
  clipCount: number;
  sizeBytes: number;
  installedAt: string;
}

export interface OfflinePackProgress {
  loaded: number;
  total: number;
  percent: number;
  currentLabel?: string;
}

const CACHE_NAME = 'dental-vi-offline-voice-v1';
const META_STORAGE_KEY = 'dental_vi_offline_pack_meta_v1';

export function normalizeOfflineKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[&]/g, ' và ')
    .replace(/[.,!?;:"'()\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getClipCacheUrl(key: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  return `${origin}/offline-vi-pack/clip?k=${encodeURIComponent(key)}`;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      if (parsed?.state?.token) return parsed.state.token;
    }
  } catch {}
  return localStorage.getItem('admin_token');
}

function trimSilenceAndCollect(
  buffer: AudioBuffer,
  threshold: number = 0.008,
  padSec: number = 0.015
): { samples: Float32Array; sampleRate: number } {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const len = channelData.length;
  if (len === 0) return { samples: new Float32Array(0), sampleRate };

  let start = 0;
  while (start < len && Math.abs(channelData[start]) < threshold) {
    start++;
  }
  let end = len - 1;
  while (end > start && Math.abs(channelData[end]) < threshold) {
    end--;
  }

  if (end <= start) {
    return { samples: new Float32Array(0), sampleRate };
  }

  const padSamples = Math.floor(padSec * sampleRate);
  start = Math.max(0, start - padSamples);
  end = Math.min(len - 1, end + padSamples);

  const sliced = channelData.slice(start, end + 1);
  // Apply tiny 4ms fade-in/out to prevent clicks at stitch seams
  const fadeSamples = Math.min(Math.floor(0.004 * sampleRate), Math.floor(sliced.length / 4));
  for (let i = 0; i < fadeSamples; i++) {
    const gain = i / fadeSamples;
    sliced[i] *= gain;
    sliced[sliced.length - 1 - i] *= gain;
  }

  return { samples: sliced, sampleRate };
}

export class OfflineVoicePackService {
  private static decodedCache = new Map<string, AudioBuffer>();
  private static activeSource: AudioBufferSourceNode | null = null;

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'caches' in window &&
      typeof AudioContext !== 'undefined'
    );
  }

  public static getMetadata(): OfflinePackMetadata | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(META_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OfflinePackMetadata;
      if (parsed && parsed.installed && Array.isArray(parsed.keys) && parsed.keys.length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  public static isInstalled(): boolean {
    return Boolean(this.getMetadata()?.installed);
  }

  public static async verifyCacheIntegrity(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const meta = this.getMetadata();
    if (!meta || !meta.installed || meta.keys.length === 0) return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      const probeKey = meta.keys[0];
      const hit = await cache.match(getClipCacheUrl(probeKey));
      return Boolean(hit);
    } catch {
      return false;
    }
  }

  public static async installOfflinePack(
    onProgress?: (progress: OfflinePackProgress) => void
  ): Promise<{ ok: boolean; meta?: OfflinePackMetadata; error?: string }> {
    if (!this.isSupported()) {
      return {
        ok: false,
        error: 'Trình duyệt hiện tại chưa hỗ trợ lưu trữ gói âm thanh ngoại tuyến.',
      };
    }

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const manifestRes = await fetch('/api/tts/offline-pack', { headers });
      if (!manifestRes.ok) {
        throw new Error('Không thể tải danh sách gói giọng đọc Tiếng Việt.');
      }

      const manifestJson = await manifestRes.json();
      const manifest = manifestJson?.data;
      const items: Array<{ key: string; text: string; url: string }> = manifest?.items || [];
      if (items.length === 0) {
        throw new Error('Danh sách gói giọng đọc trống.');
      }

      const cache = await caches.open(CACHE_NAME);
      const installedKeys: string[] = [];
      let totalBytes = 0;
      let completed = 0;
      const total = items.length;

      onProgress?.({ loaded: 0, total, percent: 0, currentLabel: 'Đang chuẩn bị gói giọng Tiếng Việt...' });

      // Concurrency-5 parallel downloader with retry
      const concurrency = 5;
      let cursor = 0;

      const worker = async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= items.length) break;
          const item = items[idx];
          const clipKey = normalizeOfflineKey(item.key || item.text);
          const cacheUrl = getClipCacheUrl(clipKey);

          try {
            // Re-use already cached valid clip to make clinic service updates super fast
            const existing = await cache.match(cacheUrl);
            if (existing && existing.ok) {
              const existingSize = Number(existing.headers.get('content-length') || 0);
              totalBytes += existingSize > 0 ? existingSize : 6200;
              installedKeys.push(clipKey);
            } else {
              const resp = await fetch(item.url);
              if (resp.ok) {
                const buf = await resp.arrayBuffer();
                if (buf.byteLength > 150) {
                  totalBytes += buf.byteLength;
                  const cachedResponse = new Response(buf, {
                    status: 200,
                    headers: {
                      'Content-Type': 'audio/mpeg',
                      'Content-Length': String(buf.byteLength),
                    },
                  });
                  await cache.put(cacheUrl, cachedResponse);
                  installedKeys.push(clipKey);
                }
              }
            }
          } catch {
            // Non-fatal skip for single transient clip
          } finally {
            completed++;
            onProgress?.({
              loaded: completed,
              total,
              percent: Math.min(100, Math.round((completed / total) * 100)),
              currentLabel: item.text,
            });
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (installedKeys.length < 20) {
        throw new Error('Kết nối không ổn định, vui lòng thử tải lại gói giọng Offline.');
      }

      const meta: OfflinePackMetadata = {
        installed: true,
        version: manifest.version || 'vi-dental-pack-v1',
        keys: Array.from(new Set(installedKeys)),
        clipCount: installedKeys.length,
        sizeBytes: totalBytes,
        installedAt: new Date().toISOString(),
      };

      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
      return { ok: true, meta };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || 'Không thể cài đặt gói giọng Offline lúc này.',
      };
    }
  }

  public static async uninstallOfflinePack(): Promise<void> {
    this.stop();
    this.decodedCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(META_STORAGE_KEY);
      if ('caches' in window) {
        try {
          await caches.delete(CACHE_NAME);
        } catch {}
      }
    }
  }

  public static stop(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
  }

  /**
   * Matches longest cached phrases & tokens sequentially to reconstruct Vietnamese speech 100% offline.
   */
  private static tokenizeMatchedClips(
    text: string,
    installedKeySet: Set<string>
  ): { tokens: Array<{ type: 'clip'; key: string; pauseAfterSec: number } | { type: 'gap'; sec: number }>; coverage: number } {
    const clean = String(text || '')
      .replace(/&/g, ' và ')
      .replace(/([.,!?;:])/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = clean.split(' ').filter(Boolean);
    const result: Array<{ type: 'clip'; key: string; pauseAfterSec: number } | { type: 'gap'; sec: number }> = [];
    let totalSpokenWords = 0;
    let matchedWords = 0;

    let i = 0;
    while (i < words.length) {
      const currentRaw = words[i];
      if (/^[.,!?;:]+$/.test(currentRaw)) {
        if (result.length > 0) {
          result.push({ type: 'gap', sec: currentRaw === ',' ? 0.09 : 0.16 });
        }
        i++;
        continue;
      }

      // Greedy longest phrase match (up to 12 words ahead)
      let matchedLen = 0;
      let matchedKey = '';
      const maxLookahead = Math.min(12, words.length - i);

      for (let len = maxLookahead; len >= 1; len--) {
        const slice = words.slice(i, i + len).filter((w) => !/^[.,!?;:]+$/.test(w));
        if (slice.length === 0) continue;
        const candidateKey = normalizeOfflineKey(slice.join(' '));
        if (candidateKey && installedKeySet.has(candidateKey)) {
          matchedLen = len;
          matchedKey = candidateKey;
          break;
        }
      }

      if (matchedLen > 0 && matchedKey) {
        const segmentWords = words.slice(i, i + matchedLen);
        const nonPunctCount = segmentWords.filter((w) => !/^[.,!?;:]+$/.test(w)).length;
        totalSpokenWords += nonPunctCount;
        matchedWords += nonPunctCount;
        const hasPunctInside = segmentWords.some((w) => /[.,!?;:]/.test(w));
        result.push({
          type: 'clip',
          key: matchedKey,
          pauseAfterSec: hasPunctInside ? 0.14 : 0.02,
        });
        i += matchedLen;
      } else {
        totalSpokenWords++;
        i++;
      }
    }

    const coverage = totalSpokenWords > 0 ? matchedWords / totalSpokenWords : 0;
    return { tokens: result, coverage };
  }

  public static async speakOffline(
    text: string,
    volume: number,
    audioCtx: AudioContext | null,
    isCancelled: () => boolean
  ): Promise<{ played: boolean; coverage?: number }> {
    if (!this.isSupported() || !audioCtx) {
      return { played: false };
    }
    const meta = this.getMetadata();
    if (!meta || !meta.installed || meta.keys.length === 0) {
      return { played: false };
    }

    const keySet = new Set(meta.keys);
    const { tokens, coverage } = this.tokenizeMatchedClips(text, keySet);
    const clipTokens = tokens.filter((t): t is { type: 'clip'; key: string; pauseAfterSec: number } => t.type === 'clip');

    if (clipTokens.length === 0) {
      return { played: false, coverage: 0 };
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const decodedSegments: Array<{ samples: Float32Array; sampleRate: number; pauseAfterSec: number }> = [];

      for (const token of tokens) {
        if (isCancelled()) return { played: false };
        if (token.type === 'gap') {
          if (decodedSegments.length > 0) {
            decodedSegments[decodedSegments.length - 1].pauseAfterSec = Math.max(
              decodedSegments[decodedSegments.length - 1].pauseAfterSec,
              token.sec
            );
          }
          continue;
        }

        let audioBuf = this.decodedCache.get(token.key);
        if (!audioBuf) {
          const cachedResp = await cache.match(getClipCacheUrl(token.key));
          if (!cachedResp) continue;
          const arrayBuf = await cachedResp.arrayBuffer();
          audioBuf = await audioCtx.decodeAudioData(arrayBuf.slice(0));
          if (this.decodedCache.size > 260) {
            const firstKey = this.decodedCache.keys().next().value;
            if (firstKey) this.decodedCache.delete(firstKey);
          }
          this.decodedCache.set(token.key, audioBuf);
        }

        const trimmed = trimSilenceAndCollect(audioBuf);
        if (trimmed.samples.length > 0) {
          decodedSegments.push({
            samples: trimmed.samples,
            sampleRate: trimmed.sampleRate,
            pauseAfterSec: token.pauseAfterSec,
          });
        }
      }

      if (decodedSegments.length === 0 || isCancelled()) {
        return { played: false };
      }

      // Stitch all trimmed PCM segments into one seamless AudioBuffer
      const targetSampleRate = decodedSegments[0].sampleRate || audioCtx.sampleRate;
      let totalSamples = 0;
      for (let i = 0; i < decodedSegments.length; i++) {
        totalSamples += decodedSegments[i].samples.length;
        if (i < decodedSegments.length - 1) {
          totalSamples += Math.floor(decodedSegments[i].pauseAfterSec * targetSampleRate);
        }
      }

      const mergedBuffer = audioCtx.createBuffer(1, Math.max(1, totalSamples), targetSampleRate);
      const out = mergedBuffer.getChannelData(0);
      let offset = 0;
      for (let i = 0; i < decodedSegments.length; i++) {
        out.set(decodedSegments[i].samples, offset);
        offset += decodedSegments[i].samples.length;
        if (i < decodedSegments.length - 1) {
          offset += Math.floor(decodedSegments[i].pauseAfterSec * targetSampleRate);
        }
      }

      if (isCancelled()) return { played: false };

      return await new Promise<{ played: boolean; coverage: number }>((resolve) => {
        let settled = false;
        let safetyTimer: any = null;

        const finish = (played: boolean) => {
          if (settled) return;
          settled = true;
          if (safetyTimer) clearTimeout(safetyTimer);
          if (this.activeSource === source) {
            this.activeSource = null;
          }
          resolve({ played, coverage });
        };

        const source = audioCtx.createBufferSource();
        source.buffer = mergedBuffer;
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = Math.max(0.1, Math.min(1.0, volume || 0.9));
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        this.activeSource = source;

        source.onended = () => finish(!isCancelled());

        const maxDurationMs = Math.max(4000, Math.ceil(mergedBuffer.duration * 1000) + 2500);
        safetyTimer = setTimeout(() => {
          try {
            source.stop();
          } catch {}
          finish(true);
        }, maxDurationMs);

        source.start(0);
      });
    } catch (err) {
      console.warn('OfflineVoicePack playback warning:', err);
      return { played: false };
    }
  }
}
