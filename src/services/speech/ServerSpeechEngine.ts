import { useVoiceStore } from '../../store/voiceStore';
import { BrowserSpeechEngine } from './BrowserSpeechEngine';

export class ServerSpeechEngine {
  private static audioCtx: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static isUnlocked = false;

  public static unlockAudio() {
    if (this.isUnlocked) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        
        // Play silent sound to unlock
        const osc = this.audioCtx.createOscillator();
        osc.connect(this.gainNode);
        this.gainNode.gain.value = 0;
        osc.start(0);
        osc.stop(0.001);
        
        this.isUnlocked = true;
      }
    } catch (e) {
      console.warn("Failed to unlock audio context", e);
    }
  }

  public static playChime(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioCtx || !this.gainNode) {
        return resolve();
      }
      
      try {
        const { volume } = useVoiceStore.getState();
        
        const playNote = (freq: number, startTime: number, duration: number) => {
          if (!this.audioCtx || !this.gainNode) return;
          const osc = this.audioCtx.createOscillator();
          const noteGain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTime);
          
          noteGain.gain.setValueAtTime(0, this.audioCtx.currentTime + startTime);
          noteGain.gain.linearRampToValueAtTime(0.1 * volume, this.audioCtx.currentTime + startTime + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + startTime + duration);
          
          osc.connect(noteGain);
          noteGain.connect(this.gainNode);
          
          osc.start(this.audioCtx.currentTime + startTime);
          osc.stop(this.audioCtx.currentTime + startTime + duration);
        };
        
        playNote(523.25, 0, 0.5); // C5
        playNote(659.25, 0.1, 0.5); // E5
        playNote(783.99, 0.2, 0.6); // G5
        
        setTimeout(resolve, 1000);
      } catch (e) {
        console.warn("Chime failed", e);
        resolve();
      }
    });
  }

  public static async speak(text: string, audioUrl?: string): Promise<void> {
    const { enabled, volume } = useVoiceStore.getState();
    if (!enabled) return Promise.resolve();

    if (!this.isUnlocked) {
      console.warn("ServerSpeechEngine: Audio is not unlocked. Speak might fail.");
    }
    
    // Always play chime first
    await this.playChime();

    // Strategy 1: Server-provided audio URL
    if (audioUrl) {
      try {
        await this.playAudioUrl(audioUrl, volume);
        return;
      } catch (e) {
        console.warn("Server audio failed, falling back", e);
      }
    }
    
    // Strategy 2: Request server to generate text on the fly
    try {
      // Need a token to call /api/tts/speak if auth is required,
      // assuming token is in localStorage for simple fallback or we skip it and go to strategy 3.
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
         try {
           const parsed = JSON.parse(authStorage);
           token = parsed.state?.token;
         } catch(e){}
      }
      
      if (token) {
        const res = await fetch('/api/tts/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text })
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.audioUrl) {
            await this.playAudioUrl(data.data.audioUrl, volume);
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Dynamic server audio failed, falling back", e);
    }
    
    // Strategy 3: Browser TTS fallback
    await BrowserSpeechEngine.speak(text, false); // pass false so BrowserSpeechEngine doesn't play chime again
  }
  
  private static playAudioUrl(url: string, volume: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.volume = volume;
      
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(new Error("Audio playback failed"));
      
      audio.play().catch(reject);
    });
  }

  public static cancel() {
    BrowserSpeechEngine.cancel();
    // HTML5 Audio cancellation would require keeping a reference to the active Audio object.
    // We'll skip that for simplicity since MP3s are short.
  }
}
