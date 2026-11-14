import { Router } from "express";
import { verifyToken } from "../../core/security.js";
import { appContext } from "../../core/context.js";
import { db } from "../../db/index.js";
import { services, providers } from "../../db/schema.js";
import { sanitizeForSpeech } from "../../services/tts/announcement.js";
import {
  getTtsStatus,
  generateAudio,
  getAudioFilePath,
  buildOfflineVoicePackManifest,
} from "../../services/tts/index.js";

const ttsRouter = Router();

// Lấy trạng thái của các TTS providers
ttsRouter.get("/status", (req, res) => {
  res.json({ success: true, data: getTtsStatus() });
});

// Manifest gói giọng đọc Tiếng Việt Offline tích hợp sẵn (tùy biến theo dịch vụ/bác sĩ của phòng khám)
ttsRouter.get("/offline-pack", async (req, res) => {
  try {
    let tenantId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const payload = verifyToken(authHeader.split(" ")[1]);
        tenantId = payload?.tenantId || null;
      } catch {
        // Fallback to public root clinic catalog
      }
    } else if (typeof req.query.tenantId === "string" && req.query.tenantId.trim()) {
      tenantId = req.query.tenantId.trim();
    }

    const catalog = await new Promise<{ serviceNames: string[]; providerNames: string[] }>((resolve) => {
      appContext.run({ tenantId }, async () => {
        try {
          const allServices = await db.select().from(services);
          const allProviders = await db.select().from(providers);
          const serviceNames = (allServices || [])
            .filter((s: any) => s && s.isActive !== false && s.name)
            .map((s: any) => sanitizeForSpeech(String(s.name)))
            .filter(Boolean);
          const providerNames = (allProviders || [])
            .filter((p: any) => p && p.isActive !== false && p.name)
            .map((p: any) => sanitizeForSpeech(String(p.name)))
            .filter(Boolean);
          resolve({ serviceNames, providerNames });
        } catch {
          resolve({ serviceNames: [], providerNames: [] });
        }
      });
    });

    const manifest = buildOfflineVoicePackManifest(catalog);
    res.json({ success: true, data: manifest });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to build offline pack manifest" });
  }
});

// Tạo hoặc trả về clip MP3 Tiếng Việt trực tiếp để lưu CacheStorage offline
ttsRouter.get("/pack-clip", async (req, res) => {
  try {
    const rawText = typeof req.query.text === "string" ? req.query.text.trim() : "";
    if (!rawText || rawText.length > 220) {
      return res.status(400).json({ success: false, error: "Invalid clip text" });
    }

    const audioUrl = await generateAudio(rawText);
    if (!audioUrl) {
      return res.status(503).json({ success: false, error: "TTS generator temporarily unavailable" });
    }

    const fileName = audioUrl.split("/").pop() || "";
    const filePath = getAudioFilePath(fileName);
    if (!filePath) {
      return res.status(404).send("Audio file not found");
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Clip error" });
  }
});

// Endpoint để đọc một đoạn text bất kỳ
ttsRouter.post("/speak", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "Missing text" });
    }
    
    const audioUrl = await generateAudio(text);
    res.json({ success: true, data: { audioUrl } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy file audio trực tiếp, dùng stream
ttsRouter.get("/audio/:fileName", (req, res) => {
  const { fileName } = req.params;
  const filePath = getAudioFilePath(fileName);
  
  if (!filePath) {
    return res.status(404).send("Not found");
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(filePath);
});

export default ttsRouter;
