import { useVoiceStore } from '../../store/voiceStore';

export interface LocalVoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  isDefault: boolean;
}

function splitVietnameseChunks(text: string, maxLen: number = 150): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const parts = clean.split(/([.!?;\n]+|,\s+)/);
  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    if ((current + part).length <= maxLen) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > maxLen) {
        const words = part.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= maxLen) {
            sub = sub ? `${sub} ${w}` : w;
          } else {
            if (sub.trim()) chunks.push(sub.trim());
            sub = w;
          }
        }
        current = sub;
      } else {
        current = part;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export class BrowserSpeechEngine {
  private static activeGeneration = 0;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  public static isVietnameseVoice(v: SpeechSynthesisVoice): boolean {
    const langNorm = (v.lang || '').toLowerCase().replace('_', '-');
    const nameLower = (v.name || '').toLowerCase();
    return (
      langNorm === 'vi' ||
      langNorm.startsWith('vi-') ||
      nameLower.includes('vietnam') ||
      nameLower.includes('tiếng việt') ||
      nameLower.includes('tieng viet') ||
      nameLower.includes('hoaimy') ||
      nameLower.includes('namminh') ||
      nameLower.includes('microsoft an') ||
      nameLower.includes('apple linh')
    );
  }

  public static async waitForVoices(timeoutMs: number = 1200): Promise<SpeechSynthesisVoice[]> {
    if (!this.isSupported()) return [];
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length > 0) return existing;

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        try {
          window.speechSynthesis.removeEventListener('voiceschanged', handler);
        } catch {}
        resolve(window.speechSynthesis.getVoices() || []);
      };
      const handler = () => done();
      try {
        window.speechSynthesis.addEventListener('voiceschanged', handler);
      } catch {}
      setTimeout(done, timeoutMs);
    });
  }

  public static getVietnameseVoices(): LocalVoiceInfo[] {
    if (!this.isSupported()) return [];
    const voices = window.speechSynthesis.getVoices() || [];
    const viVoices = voices.filter((v) => this.isVietnameseVoice(v));

    // Rank best Vietnamese voices first (HoaiMy / Google Tiếng Việt / Microsoft An / Linh / offline local)
    const score = (v: SpeechSynthesisVoice) => {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      if (v.localService) s += 20;
      if (n.includes('hoaimy') || n.includes('namminh')) s += 30;
      if (n.includes('google tiếng việt') || n.includes('google tieng viet')) s += 25;
      if (n.includes('microsoft an') || n.includes('linh')) s += 20;
      if ((v.lang || '').toLowerCase().replace('_', '-') === 'vi-vn') s += 10;
      return s;
    };

    return viVoices
      .slice()
      .sort((a, b) => score(b) - score(a))
      .map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        localService: Boolean(v.localService),
        isDefault: Boolean(v.default),
      }));
  }

  public static hasVietnameseVoice(): boolean {
    return this.getVietnameseVoices().length > 0;
  }

  private static findVietnameseVoice(preferredURI?: string): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const viVoices = voices.filter((v) => this.isVietnameseVoice(v));
    if (viVoices.length === 0) return null;

    if (preferredURI) {
      const exact = viVoices.find((v) => v.voiceURI === preferredURI);
      if (exact) return exact;
    }

    const sorted = this.getVietnameseVoices();
    const topUri = sorted[0]?.voiceURI;
    return viVoices.find((v) => v.voiceURI === topUri) || viVoices[0] || null;
  }

  /**
   * Speaks Vietnamese text strictly chunk-by-chunk with Chrome keep-alive & timeout guards.
   * Rejects broken English fallback if `requireVietnameseVoice` is true and PC lacks Vietnamese voice.
   */
  public static async speakVietnamese(
    text: string,
    options?: {
      requireVietnameseVoice?: boolean;
      preferredVoiceURI?: string;
    }
  ): Promise<{ spoken: boolean; autoplayBlocked?: boolean; reason?: string }> {
    const { enabled, rate, pitch, volume, preferredVoiceURI } = useVoiceStore.getState();
    if (!enabled) return { spoken: false, reason: 'disabled' };
    if (!this.isSupported()) return { spoken: false, reason: 'unsupported' };

    await this.waitForVoices(1200);
    const voice = this.findVietnameseVoice(options?.preferredVoiceURI ?? preferredVoiceURI);

    if (options?.requireVietnameseVoice !== false && !voice) {
      return { spoken: false, reason: 'no_vietnamese_voice' };
    }

    const chunks = splitVietnameseChunks(text, 150);
    if (chunks.length === 0) return { spoken: true };

    const myGeneration = this.activeGeneration;

    // Ensure speechSynthesis is not stuck in paused state
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    let autoplayBlocked = false;

    for (const chunk of chunks) {
      if (myGeneration !== this.activeGeneration) {
        return { spoken: false, reason: 'cancelled' };
      }

      const result = await new Promise<{ ok: boolean; blocked?: boolean }>((resolve) => {
        let settled = false;
        let safetyTimer: any = null;
        let keepAliveTimer: any = null;

        const finish = (ok: boolean, blocked = false) => {
          if (settled) return;
          settled = true;
          if (safetyTimer) clearTimeout(safetyTimer);
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          resolve({ ok, blocked });
        };

        try {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.rate = Math.max(0.6, Math.min(1.5, rate || 1.0));
          utterance.pitch = Math.max(0.6, Math.min(1.5, pitch || 1.0));
          utterance.volume = Math.max(0.1, Math.min(1.0, volume || 0.9));
          utterance.lang = voice?.lang || 'vi-VN';
          if (voice) {
            utterance.voice = voice;
          }

          utterance.onend = () => finish(true);
          utterance.onerror = (ev: any) => {
            const errCode = ev?.error || '';
            if (errCode === 'not-allowed' || errCode === 'audio-busy') {
              finish(false, errCode === 'not-allowed');
            } else {
              finish(false, false);
            }
          };

          // Chrome desktop workaround: speechSynthesis occasionally pauses mid-utterance > 10s
          keepAliveTimer = setInterval(() => {
            try {
              if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
              }
            } catch {}
          }, 3000);

          // Hard timeout per chunk so queue NEVER stalls forever if browser drops onend
          const maxWaitMs = Math.max(8000, Math.min(25000, chunk.length * 140 + 4000));
          safetyTimer = setTimeout(() => {
            try {
              window.speechSynthesis.cancel();
            } catch {}
            finish(true);
          }, maxWaitMs);

          window.speechSynthesis.speak(utterance);
        } catch {
          finish(false, false);
        }
      });

      if (result.blocked) {
        autoplayBlocked = true;
        break;
      }
      if (!result.ok && myGeneration !== this.activeGeneration) {
        return { spoken: false, reason: 'cancelled' };
      }
    }

    if (autoplayBlocked) {
      return { spoken: false, autoplayBlocked: true, reason: 'not-allowed' };
    }

    return { spoken: true };
  }

  /**
   * Legacy wrapper kept for backwards compatibility
   */
  public static async speak(text: string, _playChime: boolean = false): Promise<void> {
    await this.speakVietnamese(text, { requireVietnameseVoice: false });
  }

  public static cancel() {
    this.activeGeneration++;
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}
