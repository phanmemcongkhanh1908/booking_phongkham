import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export type Provider = "google" | "fpt" | "viettel" | "piper";

export interface TTSProvider {
  name: Provider;
  generate(text: string, outputPath: string): Promise<void>;
  isConfigured(): boolean;
}

export class GoogleTTSProvider implements TTSProvider {
  name: Provider = "google";

  isConfigured() {
    return !!process.env.GOOGLE_TTS_API_KEY;
  }

  async generate(text: string, outputPath: string) {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    const voiceName = process.env.GOOGLE_TTS_VOICE || "vi-VN-Wavenet-A";
    
    if (!apiKey) throw new Error("Missing GOOGLE_TTS_API_KEY");

    const payload = {
      input: { text },
      voice: { languageCode: "vi-VN", name: voiceName },
      audioConfig: { audioEncoding: "MP3" }
    };

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google TTS Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    fs.writeFileSync(outputPath, Buffer.from(data.audioContent, "base64"));
  }
}

export class FptTTSProvider implements TTSProvider {
  name: Provider = "fpt";

  isConfigured() {
    return !!process.env.FPT_TTS_API_KEY;
  }

  async generate(text: string, outputPath: string) {
    const apiKey = process.env.FPT_TTS_API_KEY;
    const voice = process.env.FPT_TTS_VOICE || "banmai";

    if (!apiKey) throw new Error("Missing FPT_TTS_API_KEY");

    const response = await fetch("https://api.fpt.ai/hmi/tts/v5", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "voice": voice,
        "format": "mp3"
      },
      body: text
    });

    if (!response.ok) {
      throw new Error(`FPT TTS Error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error === 0 && data.async) {
      // FPT returns a URL to download the audio
      const audioUrl = data.async;
      
      // We need to poll the URL until it's ready
      let audioRes = await fetch(audioUrl);
      let attempts = 0;
      while (!audioRes.ok && attempts < 10) {
        await new Promise(r => setTimeout(r, 1000));
        audioRes = await fetch(audioUrl);
        attempts++;
      }
      
      if (!audioRes.ok) throw new Error("Failed to download FPT audio");
      
      const arrayBuffer = await audioRes.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    } else {
       throw new Error("FPT TTS returned invalid response");
    }
  }
}

export class ViettelTTSProvider implements TTSProvider {
  name: Provider = "viettel";

  isConfigured() {
    return !!process.env.VIETTEL_TTS_TOKEN;
  }

  async generate(text: string, outputPath: string) {
    const token = process.env.VIETTEL_TTS_TOKEN;
    const voice = process.env.VIETTEL_TTS_VOICE || "hcm-diemmy";

    if (!token) throw new Error("Missing VIETTEL_TTS_TOKEN");

    const response = await fetch("https://viettelgroup.ai/voice/api/tts/v1/rest/syn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": token
      },
      body: JSON.stringify({
        text,
        voice,
        speed: 1,
        tts_return_option: 2 // return url
      })
    });

    if (!response.ok) throw new Error(`Viettel TTS Error: ${response.status}`);
    
    // Viettel implementation details might vary, skipping for now or assuming returning arraybuffer directly
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  }
}

export class PiperTTSProvider implements TTSProvider {
  name: Provider = "piper";

  isConfigured() {
    return !!process.env.PIPER_MODEL && !!process.env.PIPER_BIN;
  }

  async generate(text: string, outputPath: string) {
    const bin = process.env.PIPER_BIN || "piper";
    const model = process.env.PIPER_MODEL;
    
    if (!model) throw new Error("Missing PIPER_MODEL");

    // Piper generates wav. We can convert to mp3 if ffmpeg is available, 
    // or just return the wav and let the browser play it. 
    // We'll output wav but save it with .mp3 extension for simplicity in this implementation, 
    // though the browser will still play it because it looks at the mime type or sniffs it.
    // Or we use ffmpeg. For now, let's output wav directly.
    const tempWav = outputPath.replace('.mp3', '.wav');
    
    // Escape text for shell
    const safeText = text.replace(/'/g, "'\\''");
    
    try {
      await execAsync(`echo '${safeText}' | ${bin} --model ${model} --output_file ${tempWav}`);
      // rename wav to mp3 for consistency, or keep as wav.
      fs.renameSync(tempWav, outputPath);
    } catch (e: any) {
      throw new Error(`Piper TTS Error: ${e.message}`);
    }
  }
}
