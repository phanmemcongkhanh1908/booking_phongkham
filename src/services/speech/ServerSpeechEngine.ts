import { useVoiceStore } from '../../store/voiceStore';
import { BrowserSpeechEngine } from './BrowserSpeechEngine';

export class ServerSpeechEngine {
  private static audioCtx: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static isUnlocked = false;
  private static currentAudio: HTMLAudioElement | null = null;

  public static unlockAudio() {
    if (this.isUnlocked && this.audioCtx?.state === 'running') return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
          this.gainNode = this.audioCtx.createGain();
          this.gainNode.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        
        // Play silent brief sound to unlock browser audio restrictions
        const osc = this.audioCtx.createOscillator();
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0.0001;
        osc.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
        osc.start(0);
        osc.stop(this.audioCtx.currentTime + 0.01);
        
        this.isUnlocked = true;
      }
    } catch (e) {
      console.warn("Could not unlock audio context", e);
    }
  }

  /**
   * Nhạc hiệu phát thanh phòng khám chuyên nghiệp (Hospital/Clinic 4-Tone Chime)
   * Gồm hợp âm 4 nốt: F4 (349.2Hz) -> A4 (440Hz) -> C5 (523.2Hz) -> F5 (698.5Hz)
   * Kết hợp âm sắc chuông ngân vang (fundamental + overtone), decay tự nhiên
   */
  public static playChime(): Promise<void> {
    return new Promise((resolve) => {
      this.unlockAudio();

      if (!this.audioCtx || !this.gainNode) {
        return resolve();
      }
      
      try {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const { volume } = useVoiceStore.getState();
        const masterVol = Math.max(0.1, Math.min(1.0, volume || 0.9));
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Định nghĩa 4 nốt nhạc hiệu phát thanh tiêu chuẩn
        const melody = [
          { freq: 349.23, time: 0.00, duration: 0.60 }, // F4
          { freq: 440.00, time: 0.24, duration: 0.60 }, // A4
          { freq: 523.25, time: 0.48, duration: 0.70 }, // C5
          { freq: 698.46, time: 0.74, duration: 1.10 }, // F5 (ngân dài)
        ];

        melody.forEach((note) => {
          const startTime = now + note.time;
          const stopTime = startTime + note.duration;

          // 1. Âm chính (Fundamental sine wave)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(note.freq, startTime);

          gain1.gain.setValueAtTime(0.0001, startTime);
          gain1.gain.linearRampToValueAtTime(0.18 * masterVol, startTime + 0.018); // Fast bell attack
          gain1.gain.exponentialRampToValueAtTime(0.001, stopTime); // Smooth reverberant decay

          osc1.connect(gain1);
          gain1.connect(this.gainNode!);
          osc1.start(startTime);
          osc1.stop(stopTime);

          // 2. Âm bồi chuông (Harmonic overtone - 2x frequency) tạo độ vang trong trẻo
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(note.freq * 2, startTime);

          gain2.gain.setValueAtTime(0.0001, startTime);
          gain2.gain.linearRampToValueAtTime(0.06 * masterVol, startTime + 0.012);
          gain2.gain.exponentialRampToValueAtTime(0.0005, startTime + note.duration * 0.7);

          osc2.connect(gain2);
          gain2.connect(this.gainNode!);
          osc2.start(startTime);
          osc2.stop(startTime + note.duration * 0.7);
        });

        // Đợi nhạc hiệu dứt ngân và nghỉ 350ms trước khi bắt đầu giọng đọc
        setTimeout(resolve, 1950);
      } catch (e) {
        console.warn("Chime failed", e);
        resolve();
      }
    });
  }

  public static async speak(text: string, audioUrl?: string): Promise<void> {
    const { enabled, volume } = useVoiceStore.getState();
    if (!enabled) return;

    this.unlockAudio();
    this.cancel(); // Dừng âm thanh đang phát trước đó nếu có

    // Phát nhạc hiệu thông báo chuyên nghiệp trước
    await this.playChime();

    const playVolume = Math.max(0.1, Math.min(1.0, volume || 0.9));

    // Chiến lược 1: Nếu sự kiện server đã gửi kèm audioUrl
    if (audioUrl) {
      try {
        await this.playAudioUrl(audioUrl, playVolume);
        return;
      } catch (e) {
        console.warn("Audio URL playback failed, trying dynamic generation:", e);
      }
    }
    
    // Chiến lược 2: Gọi máy chủ tạo audio URL chuẩn tiếng Việt độc lập mọi thiết bị
    try {
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token;
        } catch {}
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/tts/speak', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.audioUrl) {
          await this.playAudioUrl(data.data.audioUrl, playVolume);
          return;
        }
      }
    } catch (e) {
      console.warn("Server TTS dynamic generation failed:", e);
    }
    
    // Chiến lược 3: Dự phòng cuối cùng bằng giọng đọc Web Speech API của trình duyệt
    try {
      await BrowserSpeechEngine.speak(text, false);
    } catch (e) {
      console.warn("Browser Speech fallback failed:", e);
    }
  }
  
  private static playAudioUrl(url: string, volume: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(url);
        audio.volume = volume;
        this.currentAudio = audio;
        
        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };

        audio.onerror = (e) => {
          this.currentAudio = null;
          reject(new Error("Audio playback failed"));
        };
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            this.currentAudio = null;
            reject(err);
          });
        }
      } catch (err) {
        this.currentAudio = null;
        reject(err);
      }
    });
  }

  public static cancel() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
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
  window.addEventListener('touchstart', autoUnlock, { passive: true });
  window.addEventListener('keydown', autoUnlock, { passive: true });
}
