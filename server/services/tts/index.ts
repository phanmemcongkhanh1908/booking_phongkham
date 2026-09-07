import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleTTSProvider, FptTTSProvider, ViettelTTSProvider, PiperTTSProvider, TTSProvider, Provider } from "./providers.js";

const providers: Record<Provider, TTSProvider> = {
  google: new GoogleTTSProvider(),
  fpt: new FptTTSProvider(),
  viettel: new ViettelTTSProvider(),
  piper: new PiperTTSProvider(),
};

const CACHE_DIR = path.join(process.cwd(), ".cache", "tts");
const MAX_CACHE_FILES = parseInt(process.env.TTS_CACHE_MAX_FILES || "1000", 10);

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getActiveProviders(): TTSProvider[] {
  const envProviders = (process.env.TTS_PROVIDER || "").split(",").map(p => p.trim().toLowerCase() as Provider);
  
  const active: TTSProvider[] = [];
  for (const p of envProviders) {
    if (providers[p] && providers[p].isConfigured()) {
      active.push(providers[p]);
    }
  }
  return active;
}

export function getTtsStatus() {
  const active = getActiveProviders();
  return {
    enabled: active.length > 0,
    providers: active.map(p => p.name)
  };
}

export async function generateAudio(text: string): Promise<string | null> {
  const active = getActiveProviders();
  if (active.length === 0) return null;

  // Hash text to create a unique cache key
  const hash = crypto.createHash("md5").update(text).digest("hex");
  const fileName = `${hash}.mp3`;
  const filePath = path.join(CACHE_DIR, fileName);

  // Check cache
  if (fs.existsSync(filePath)) {
    return `/api/tts/audio/${fileName}`;
  }

  // Try providers in order
  for (const provider of active) {
    try {
      await provider.generate(text, filePath);
      console.log(`[TTS] Đã tạo audio bằng ${provider.name} cho text: "${text.substring(0, 30)}..."`);
      cleanUpCache();
      return `/api/tts/audio/${fileName}`;
    } catch (e) {
      console.error(`[TTS] Lỗi khi tạo audio bằng ${provider.name}:`, e);
      // Fall through to next provider
    }
  }

  return null; // All failed
}

function cleanUpCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR).map(name => ({
      name,
      time: fs.statSync(path.join(CACHE_DIR, name)).mtime.getTime()
    })).sort((a, b) => a.time - b.time);

    if (files.length > MAX_CACHE_FILES) {
      const toDelete = files.slice(0, files.length - MAX_CACHE_FILES);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(CACHE_DIR, file.name));
      }
    }
  } catch (e) {
    console.error("[TTS] Cache cleanup error", e);
  }
}

export function getAudioFilePath(fileName: string): string | null {
  const safeName = path.basename(fileName);
  const filePath = path.join(CACHE_DIR, safeName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}
