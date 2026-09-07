import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VoiceState {
  enabled: boolean;
  rate: number;
  pitch: number;
  volume: number;
  preferredVoiceURI?: string;
  setEnabled: (enabled: boolean) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setPreferredVoiceURI: (uri: string) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: false,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      preferredVoiceURI: undefined,
      setEnabled: (enabled) => set({ enabled }),
      setRate: (rate) => set({ rate }),
      setPitch: (pitch) => set({ pitch }),
      setVolume: (volume) => set({ volume }),
      setPreferredVoiceURI: (preferredVoiceURI) => set({ preferredVoiceURI }),
    }),
    {
      name: 'voice-settings',
    }
  )
);
