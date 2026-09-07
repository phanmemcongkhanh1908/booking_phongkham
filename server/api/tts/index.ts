import { Router } from "express";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { getTtsStatus, generateAudio, getAudioFilePath } from "../../services/tts/index.js";

const ttsRouter = Router();

// Lấy trạng thái của các TTS providers (có public/auth không tuỳ yêu cầu, auth cho an toàn)
ttsRouter.get("/status", requireAuth, (req, res) => {
  res.json({ success: true, data: getTtsStatus() });
});

// Endpoint để đọc một đoạn text bất kỳ (phục vụ test)
ttsRouter.post("/speak", requireAuth, async (req, res) => {
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
// Auth ở đây có thể cần qua token query params
ttsRouter.get("/audio/:fileName", (req, res) => {
  // TODO: Add basic auth check if needed, but the file names are random hashes 
  // and do not contain sensitive info, so they are practically unguessable public URLs.
  const { fileName } = req.params;
  const filePath = getAudioFilePath(fileName);
  
  if (!filePath) {
    return res.status(404).send("Not found");
  }

  res.sendFile(filePath);
});

export default ttsRouter;
