import { useVoiceStore } from '../../store/voiceStore';
import { BrowserSpeechEngine } from './BrowserSpeechEngine';
import { OfflineVoicePackService } from './OfflineVoicePackService';

export interface SpeakOptions {
  playChime?: boolean;
  generationId?: number;
}

export interface SpeakResult {
  played: boolean;
  autoplayBlocked?: boolean;
  cancelled?: boolean;
  engineUsed?: 'server_audio' | 'browser_offline' | 'none';
}

const audioUnlockListeners = new Set<(unlocked: boolean) => void>();

export class ServerSpeechEngine {
  private static audioCtx: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static isUnlocked = false;
  private static currentAudio: HTMLAudioElement | null = null;
  private static activeGeneration = 0;
  private static chimeTimer: any = null;
  private static activeOscillators: OscillatorNode[] = [];

  public static onUnlockChange(listener: (unlocked: boolean) => void): () => void {
    audioUnlockListeners.add(listener);
    return () => audioUnlockListeners.delete(listener);
  }

  private static notifyUnlockState(unlocked: boolean) {
    this.isUnlocked = unlocked;
    audioUnlockListeners.forEach((cb) => {
      try {
        cb(unlocked);
      } catch {}
    });
  }

  public static isAudioUnlocked(): boolean {
    if (typeof window === 'undefined') return true;
    return this.isUnlocked && this.audioCtx?.state === 'running';
  }

  public static unlockAudio(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isUnlocked && this.audioCtx?.state === 'running') return true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioContextClass();
          this.gainNode = this.audioCtx.createGain();
          this.gainNode.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        // Play near-zero gain pulse on user gesture to unlock Web Audio & HTMLAudio autoplay
        const osc = this.audioCtx.createOscillator();
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0.0001;
        osc.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
        osc.start(0);
        osc.stop(this.audioCtx.currentTime + 0.01);

        const running = this.audioCtx.state === 'running';
        if (running) {
          this.notifyUnlockState(true);
        }
        return true;
      }
    } catch (e) {
      console.warn('Could not unlock audio context', e);
    }
    return false;
  }

  /**
   * Nhạc hiệu phát thanh phòng khám chuyên nghiệp (Hospital/Clinic 4-Tone Chime)
   * F4 (349.2Hz) -> A4 (440Hz) -> C5 (523.2Hz) -> F5 (698.5Hz)
   */
  public static playChime(generationId?: number): Promise<boolean> {
    return this.playChimeDetailed(generationId).then((r) => r.played);
  }

  private static async playChimeDetailed(
    generationId?: number
  ): Promise<{ played: boolean; autoplayBlocked?: boolean; cancelled?: boolean }> {
    const gen = generationId ?? this.activeGeneration;
    if (gen !== this.activeGeneration) {
      return { played: false, cancelled: true };
    }

    this.unlockAudio();

    if (!this.audioCtx || !this.gainNode || this.audioCtx.state === 'closed') {
      return { played: true };
    }

    try {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      if (gen !== this.activeGeneration) {
        return { played: false, cancelled: true };
      }

      // If still suspended (user hasn't interacted with page yet), signal autoplay block cleanly
      if (this.audioCtx.state === 'suspended') {
        this.notifyUnlockState(false);
        return { played: false, autoplayBlocked: true };
      }

      this.notifyUnlockState(true);
    } catch {
      return { played: false, autoplayBlocked: true };
    }

    return new Promise((resolve) => {
      if (gen !== this.activeGeneration) {
        return resolve({ played: false, cancelled: true });
      }

      try {
        const { volume } = useVoiceStore.getState();
        const masterVol = Math.max(0.1, Math.min(1.0, volume || 0.9));
        const ctx = this.audioCtx!;
        const now = ctx.currentTime;

        const melody = [
          { freq: 349.23, time: 0.0, duration: 0.58 }, // F4
          { freq: 440.0, time: 0.24, duration: 0.58 }, // A4
          { freq: 523.25, time: 0.48, duration: 0.68 }, // C5
          { freq: 698.46, time: 0.74, duration: 1.05 }, // F5
        ];

        const createdOscs: OscillatorNode[] = [];

        melody.forEach((note) => {
          const startTime = now + note.time;
          const stopTime = startTime + note.duration;

          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(note.freq, startTime);
          gain1.gain.setValueAtTime(0.0001, startTime);
          gain1.gain.linearRampToValueAtTime(0.22 * masterVol, startTime + 0.018);
          gain1.gain.exponentialRampToValueAtTime(0.001, stopTime);
          osc1.connect(gain1);
          gain1.connect(this.gainNode!);
          osc1.start(startTime);
          osc1.stop(stopTime);
          createdOscs.push(osc1);

          // Harmonic overtone (bell shimmer)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(note.freq * 2, startTime);
          gain2.gain.setValueAtTime(0.0001, startTime);
          gain2.gain.linearRampToValueAtTime(0.07 * masterVol, startTime + 0.012);
          gain2.gain.exponentialRampToValueAtTime(0.0005, startTime + note.duration * 0.7);
          osc2.connect(gain2);
          gain2.connect(this.gainNode!);
          osc2.start(startTime);
          osc2.stop(startTime + note.duration * 0.7);
          createdOscs.push(osc2);
        });

        this.activeOscillators = createdOscs;
        this.chimeTimer = setTimeout(() => {
          this.chimeTimer = null;
          this.activeOscillators = [];
          const ok = gen === this.activeGeneration;
          resolve({ played: ok, cancelled: !ok });
        }, 1900);
      } catch (e) {
        console.warn('Chime failed', e);
        this.chimeTimer = null;
        this.activeOscillators = [];
        resolve({ played: true });
      }
    });
  }

  private static waitMs(ms: number, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(gen === this.activeGeneration);
      }, ms);
    });
  }

  /**
   * Executes ONE notification cleanly from start to finish WITHOUT cancelling prior items.
   * Must be invoked sequentially via TTSQueueManager to prevent overlapping playback.
   */
  public static async speakQueued(
    text: string,
    audioUrl?: string,
    options?: SpeakOptions
  ): Promise<SpeakResult> {
    const { enabled, volume, voiceMode } = useVoiceStore.getState();
    if (!enabled) return { played: false, engineUsed: 'none' };

    const myGen = options?.generationId ?? this.activeGeneration;
    const playVolume = Math.max(0.1, Math.min(1.0, volume || 0.9));

    // Step 1: Attention-grabbing Chime BEFORE Vietnamese Speech
    if (options?.playChime !== false) {
      const chimeRes = await this.playChimeDetailed(myGen);
      if (chimeRes.cancelled || myGen !== this.activeGeneration) {
        return { played: false, cancelled: true, engineUsed: 'none' };
      }
      if (chimeRes.autoplayBlocked) {
        return { played: false, autoplayBlocked: true, engineUsed: 'none' };
      }
      const gapOk = await this.waitMs(240, myGen);
      if (!gapOk) {
        return { played: false, cancelled: true, engineUsed: 'none' };
      }
    }

    // Helper: Try In-App Offline Voice Pack first (or OS Vietnamese voice) without network dependency
    const tryOfflineVietnamese = async (): Promise<SpeakResult> => {
      if (OfflineVoicePackService.isInstalled()) {
        this.unlockAudio();
        const packRes = await OfflineVoicePackService.speakOffline(
          text,
          playVolume,
          this.audioCtx,
          () => myGen !== this.activeGeneration
        );
        if (myGen !== this.activeGeneration) {
          return { played: false, cancelled: true, engineUsed: 'none' };
        }
        if (packRes.played && ((packRes.coverage ?? 0) >= 0.75 || !BrowserSpeechEngine.hasVietnameseVoice())) {
          return { played: true, engineUsed: 'browser_offline' };
        }
      }

      const res = await BrowserSpeechEngine.speakVietnamese(text, {
        requireVietnameseVoice: true,
      });
      if (myGen !== this.activeGeneration || res.reason === 'cancelled') {
        return { played: false, cancelled: true, engineUsed: 'none' };
      }
      if (res.autoplayBlocked) {
        this.notifyUnlockState(false);
        return { played: false, autoplayBlocked: true, engineUsed: 'none' };
      }
      if (res.spoken) {
        return { played: true, engineUsed: 'browser_offline' };
      }

      // Final offline attempt if pack was partially matched even with low threshold
      if (OfflineVoicePackService.isInstalled()) {
        this.unlockAudio();
        const packRetry = await OfflineVoicePackService.speakOffline(
          text,
          playVolume,
          this.audioCtx,
          () => myGen !== this.activeGeneration
        );
        if (packRetry.played) {
          return { played: true, engineUsed: 'browser_offline' };
        }
      }

      return { played: false, engineUsed: 'none' };
    };

    // Helper: Try Free Online Vietnamese TTS via Server MP3 (/api/tts/speak & cached audioUrl)
    const tryOnlineServerTTS = async (): Promise<SpeakResult> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false && !audioUrl) {
        return { played: false, engineUsed: 'none' };
      }

      if (audioUrl) {
        const res = await this.playAudioUrl(audioUrl, playVolume, myGen);
        if (res.cancelled) return { played: false, cancelled: true, engineUsed: 'none' };
        if (res.autoplayBlocked) {
          this.notifyUnlockState(false);
          return { played: false, autoplayBlocked: true, engineUsed: 'none' };
        }
        if (res.played) return { played: true, engineUsed: 'server_audio' };
      }

      try {
        const authStorage = localStorage.getItem('auth-storage');
        let token: string | null = null;
        if (authStorage) {
          try {
            token = JSON.parse(authStorage)?.state?.token || null;
          } catch {}
        }
        if (!token) {
          token = localStorage.getItem('admin_token');
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 9000);
        const res = await fetch('/api/tts/speak', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (myGen !== this.activeGeneration) {
          return { played: false, cancelled: true, engineUsed: 'none' };
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.audioUrl) {
            const playRes = await this.playAudioUrl(data.data.audioUrl, playVolume, myGen);
            if (playRes.cancelled) return { played: false, cancelled: true, engineUsed: 'none' };
            if (playRes.autoplayBlocked) {
              this.notifyUnlockState(false);
              return { played: false, autoplayBlocked: true, engineUsed: 'none' };
            }
            if (playRes.played) return { played: true, engineUsed: 'server_audio' };
          }
        }
      } catch (e) {
        console.warn('Server free Vietnamese TTS failed:', e);
      }

      return { played: false, engineUsed: 'none' };
    };

    // Execute voice mode strategy (100% Free)
    if (voiceMode === 'offline_first') {
      const offlineRes = await tryOfflineVietnamese();
      if (offlineRes.played || offlineRes.cancelled || offlineRes.autoplayBlocked) {
        return offlineRes;
      }
      // Machine has no offline Vietnamese voice -> fall back transparently to Free Online Vietnamese MP3
      return await tryOnlineServerTTS();
    }

    if (voiceMode === 'online_only') {
      const onlineRes = await tryOnlineServerTTS();
      if (onlineRes.played || onlineRes.cancelled || onlineRes.autoplayBlocked) {
        return onlineRes;
      }
      // If network dropped, fallback to offline Vietnamese voice if installed
      return await tryOfflineVietnamese();
    }

    // Default 'auto': Free Online Server Vietnamese MP3 works cleanly on EVERY PC/browser,
    // with automatic fallback to Offline Vietnamese voice pack if server/internet is unavailable.
    const onlineRes = await tryOnlineServerTTS();
    if (onlineRes.played || onlineRes.cancelled || onlineRes.autoplayBlocked) {
      return onlineRes;
    }

    return await tryOfflineVietnamese();
  }

  /**
   * Direct single-item speak (cancels active audio first).
   * For concurrent notifications, always enqueue via TTSQueueManager instead.
   */
  public static async speak(text: string, audioUrl?: string, options?: SpeakOptions): Promise<SpeakResult> {
    this.cancel();
    return this.speakQueued(text, audioUrl, {
      ...options,
      generationId: this.activeGeneration,
    });
  }

  private static playAudioUrl(
    url: string,
    volume: number,
    generationId: number
  ): Promise<{ played: boolean; autoplayBlocked?: boolean; cancelled?: boolean }> {
    return new Promise((resolve) => {
      if (generationId !== this.activeGeneration) {
        return resolve({ played: false, cancelled: true });
      }

      let settled = false;
      let loadTimeout: any = null;
      let playbackTimeout: any = null;
      const audio = new Audio(url);
      audio.volume = volume;
      this.currentAudio = audio;

      const cleanup = () => {
        if (loadTimeout) clearTimeout(loadTimeout);
        if (playbackTimeout) clearTimeout(playbackTimeout);
        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
        audio.onplaying = null;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      const finish = (res: { played: boolean; autoplayBlocked?: boolean; cancelled?: boolean }) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(res);
      };

      loadTimeout = setTimeout(() => {
        try {
          audio.pause();
        } catch {}
        finish({ played: false });
      }, 12000);

      audio.onplaying = () => {
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        this.notifyUnlockState(true);
        // Absolute max playback safety timeout (45s) so queue can never hang
        playbackTimeout = setTimeout(() => {
          try {
            audio.pause();
          } catch {}
          finish({ played: true });
        }, 45000);
      };

      audio.onended = () => {
        finish({ played: true });
      };

      audio.onabort = () => {
        finish({
          played: false,
          cancelled: generationId !== this.activeGeneration,
        });
      };

      audio.onerror = () => {
        finish({ played: false });
      };

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err: any) => {
            const isBlocked = err?.name === 'NotAllowedError';
            try {
              audio.pause();
            } catch {}
            finish({ played: false, autoplayBlocked: isBlocked });
          });
        }
      } catch (err: any) {
        finish({ played: false, autoplayBlocked: err?.name === 'NotAllowedError' });
      }
    });
  }

  public static async testOfflineVoice(
    playChime: boolean = true,
    preferredVoiceURI?: string
  ): Promise<{ ok: boolean; source?: 'offline_pack' | 'os_voice' }> {
    this.cancel();
    const myGen = this.activeGeneration;
    this.unlockAudio();

    if (playChime) {
      const chime = await this.playChimeDetailed(myGen);
      if (chime.cancelled || chime.autoplayBlocked) {
        return { ok: false };
      }
      await this.waitMs(200, myGen);
    }

    const { volume } = useVoiceStore.getState();
    const playVolume = Math.max(0.1, Math.min(1.0, volume || 0.9));

    if (OfflineVoicePackService.isInstalled()) {
      const res = await OfflineVoicePackService.speakOffline(
        'Kiểm tra gói giọng đọc tiếng Việt ngoại tuyến thành công.',
        playVolume,
        this.audioCtx,
        () => myGen !== this.activeGeneration
      );
      if (res.played) {
        return { ok: true, source: 'offline_pack' };
      }
    }

    const osRes = await BrowserSpeechEngine.speakVietnamese(
      'Kiểm tra giọng đọc tiếng Việt ngoại tuyến trên thiết bị của bạn.',
      { requireVietnameseVoice: true, preferredVoiceURI }
    );
    if (osRes.spoken) {
      return { ok: true, source: 'os_voice' };
    }
    return { ok: false };
  }

  public static getGenerationId(): number {
    return this.activeGeneration;
  }

  public static cancel() {
    this.activeGeneration++;
    OfflineVoicePackService.stop();

    if (this.chimeTimer) {
      clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }

    if (this.activeOscillators.length > 0) {
      this.activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      this.activeOscillators = [];
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }

    BrowserSpeechEngine.cancel();
  }
}

// Tự động mở khóa AudioContext ngay khi người dùng click/chạm vào ứng dụng
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    ServerSpeechEngine.unlockAudio();
  };
  window.addEventListener('click', autoUnlock, { passive: true });
  window.addEventListener('pointerdown', autoUnlock, { passive: true });
  window.addEventListener('touchstart', autoUnlock, { passive: true });
  window.addEventListener('keydown', autoUnlock, { passive: true });

  // When mobile PWA wakes up from lock screen or background, re-sync Web Audio state
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ServerSpeechEngine.unlockAudio();
    }
  });
  window.addEventListener('pageshow', () => {
    ServerSpeechEngine.unlockAudio();
  });
}
