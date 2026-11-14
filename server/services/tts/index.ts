import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleTTSProvider, GooglePublicTTSProvider, FptTTSProvider, ViettelTTSProvider, PiperTTSProvider, TTSProvider, Provider } from "./providers.js";

const providers: Record<Provider, TTSProvider> = {
  google: new GoogleTTSProvider(),
  google_public: new GooglePublicTTSProvider(),
  fpt: new FptTTSProvider(),
  viettel: new ViettelTTSProvider(),
  piper: new PiperTTSProvider(),
};

const CACHE_DIR = path.join(process.cwd(), ".cache", "tts");
const MAX_CACHE_FILES = parseInt(process.env.TTS_CACHE_MAX_FILES || "2500", 10);

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getActiveProviders(): TTSProvider[] {
  const envProviders = (process.env.TTS_PROVIDER || "")
    .split(",")
    .map(p => p.trim().toLowerCase() as Provider)
    .filter(Boolean);
  
  const active: TTSProvider[] = [];
  for (const p of envProviders) {
    if (providers[p] && providers[p].isConfigured()) {
      active.push(providers[p]);
    }
  }

  // Tự động kích hoạt các nhà cung cấp sẵn sàng, luôn có GooglePublicTTS làm chuẩn độc lập thiết bị
  if (active.length === 0) {
    if (providers.google.isConfigured()) active.push(providers.google);
    if (providers.fpt.isConfigured()) active.push(providers.fpt);
    if (providers.viettel.isConfigured()) active.push(providers.viettel);
    if (providers.piper.isConfigured()) active.push(providers.piper);
    // Luôn có Google Public Voice chuẩn tiếng Việt mọi thiết bị
    active.push(providers.google_public);
  }

  return active;
}

export function getTtsStatus() {
  const active = getActiveProviders();
  return {
    enabled: active.length > 0,
    providers: active.map(p => p.displayName || p.name)
  };
}

export interface OfflinePackItem {
  key: string;
  text: string;
  category: "phrase" | "time" | "number" | "service" | "doctor" | "name";
  url: string;
}

export function normalizeOfflineSpeechKey(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:"'()\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CORE_ANNOUNCEMENT_PHRASES = [
  "Thông báo: Có khách hàng mới đặt lịch.",
  "Khách hàng",
  "Dịch vụ",
  "Bác sĩ",
  "Thời gian hẹn",
  "Nhắc nhở",
  "Lịch hẹn của khách hàng",
  "đặt dịch vụ",
  "chưa được chốt lịch.",
  "Quản lý phòng khám vui lòng kiểm tra và xác nhận ngay.",
  "Hệ thống phát thanh thông báo phòng khám đang hoạt động tiêu chuẩn.",
  "Nhạc hiệu và giọng đọc tiếng Việt rõ ràng, sẵn sàng phục vụ!",
  "Kiểm tra gói giọng đọc tiếng Việt ngoại tuyến thành công.",
  "không xác định",
  "khám nha khoa",
  "và",
];

const TIME_AND_DATE_WORDS = [
  "giờ",
  "phút",
  "ngày",
  "tháng",
  "năm",
  "lúc",
  "hôm nay",
  "lần",
];

const COMMON_VIETNAMESE_NAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Văn", "Thị", "Minh", "Anh",
  "Tuấn", "Dũng", "Hùng", "Linh", "Trang", "Hà", "Hương", "Thảo", "Phương", "Mai",
  "Lan", "Hoa", "Ngọc", "Bảo", "Gia", "Khánh", "Đức", "Phúc", "Lộc", "Quân",
  "Khoa", "Nam", "Huy", "Đạt", "Phong", "Hiếu", "Long", "Trung", "Sơn", "Thanh",
  "Thành", "Hải", "Vinh", "Tú", "Trâm", "Nhi", "Vy", "Uyên", "Quỳnh", "Yến",
  "Nhung", "Loan", "Nga", "Hạnh", "Huyền", "Phượng", "Chi", "Ngân", "My", "Khang",
  "An", "Bình", "Cường", "Tâm", "Thúy", "Tùng", "Việt", "Quang", "Thái", "Tiến",
  "Thịnh", "Toàn", "Hữu", "Quốc", "Duy", "Kiên", "Châu", "Thủy", "Vân", "Xuân",
  "Thử nghiệm",
];

export function buildOfflineVoicePackManifest(options?: {
  serviceNames?: string[];
  providerNames?: string[];
}) {
  const seen = new Set<string>();
  const items: OfflinePackItem[] = [];

  const pushItem = (rawText: string, category: OfflinePackItem["category"]) => {
    const clean = String(rawText || "").replace(/\s+/g, " ").trim();
    if (!clean) return;
    const key = normalizeOfflineSpeechKey(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({
      key,
      text: clean,
      category,
      url: `/api/tts/pack-clip?text=${encodeURIComponent(clean)}`,
    });
  };

  for (const p of CORE_ANNOUNCEMENT_PHRASES) pushItem(p, "phrase");
  for (const t of TIME_AND_DATE_WORDS) pushItem(t, "time");

  for (let n = 0; n <= 59; n++) {
    pushItem(String(n), "number");
  }
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y <= currentYear + 2; y++) {
    pushItem(String(y), "number");
  }

  for (const sName of options?.serviceNames || []) {
    pushItem(sName, "service");
  }
  for (const pName of options?.providerNames || []) {
    pushItem(pName, "doctor");
  }

  for (const name of COMMON_VIETNAMESE_NAMES) {
    pushItem(name, "name");
  }

  return {
    version: "vi-dental-pack-v1",
    totalClips: items.length,
    estimatedSizeKB: Math.round(items.length * 6.5),
    items,
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
