import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VoiceMode = 'auto' | 'offline_first' | 'online_only';

export interface VoiceState {
  enabled: boolean;
  rate: number;
  pitch: number;
  volume: number;
  preferredVoiceURI?: string;
  voiceMode: VoiceMode;
  setEnabled: (enabled: boolean) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setPreferredVoiceURI: (uri?: string) => void;
  setVoiceMode: (mode: VoiceMode) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: true,
      rate: 1.0,
      pitch: 1.0,
      volume: 0.9,
      preferredVoiceURI: undefined,
      voiceMode: 'auto',
      setEnabled: (enabled) => set({ enabled }),
      setRate: (rate) => set({ rate }),
      setPitch: (pitch) => set({ pitch }),
      setVolume: (volume) => set({ volume }),
      setPreferredVoiceURI: (preferredVoiceURI) => set({ preferredVoiceURI }),
      setVoiceMode: (voiceMode) => set({ voiceMode }),
    }),
    {
      name: 'voice-settings',
    }
  )
);
