import { useVoiceStore } from '../../store/voiceStore';

export class BrowserSpeechEngine {
  private static findVietnameseVoice(): SpeechSynthesisVoice | null {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Google Cloud Voice (Chrome)
    let target = voices.find(v => v.name.includes('Google Tiếng Việt') || v.name.includes('Google tieng viet'));
    
    // 2. Windows 11 high-quality
    if (!target) {
      target = voices.find(v => v.name.includes('HoaiMy') || v.name.includes('Microsoft An') || v.name.includes('Vietnamese'));
    }

    // 3. Fallback vi-VN lang code
    if (!target) {
      target = voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'vi-vn');
    }
    
    return target || null;
  }

  public static async speak(text: string, playChime: boolean = true): Promise<void> {
    const { enabled, rate, pitch, volume } = useVoiceStore.getState();
    if (!enabled || !('speechSynthesis' in window)) return Promise.resolve();

    return new Promise((resolve) => {
      // Clean up any ongoing speech
      window.speechSynthesis.cancel();

      // Play a short chime using Web Audio API before speaking
      if (playChime) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const playNote = (freq: number, startTime: number, duration: number) => {
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
              gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
              gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTime + 0.05);
              gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
              osc.connect(gainNode);
              gainNode.connect(ctx.destination);
              osc.start(ctx.currentTime + startTime);
              osc.stop(ctx.currentTime + startTime + duration);
            };
            playNote(523.25, 0, 0.5); // C5
            playNote(659.25, 0.1, 0.5); // E5
            playNote(783.99, 0.2, 0.6); // G5
            
            setTimeout(() => { if (ctx.state !== 'closed') ctx.close(); }, 1500);
          }
        } catch (err) {
          console.warn("Chime failed", err);
        }
      }

      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        utterance.lang = 'vi-VN';

        const doSpeak = () => {
          const voice = this.findVietnameseVoice();
          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          }
          
          utterance.onend = () => resolve();
          utterance.onerror = (e) => {
            console.warn("TTS Error:", e);
            resolve(); // continue queue even on error
          };
          
          window.speechSynthesis.speak(utterance);
        };

        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          let spoken = false;
          const handler = () => {
            if (!spoken) {
              spoken = true;
              doSpeak();
              window.speechSynthesis.removeEventListener('voiceschanged', handler);
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', handler);
          setTimeout(() => {
            if (!spoken) {
              spoken = true;
              doSpeak();
              window.speechSynthesis.removeEventListener('voiceschanged', handler);
            }
          }, 1000);
        } else {
          doSpeak();
        }
      }, 700); // Wait for chime
    });
  }

  public static cancel() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
