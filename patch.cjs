const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf-8');

// Imports
if (!code.includes('useVoiceStore')) {
  code = code.replace("import { useAuthStore } from '../../store/auth';", "import { useAuthStore } from '../../store/auth';\nimport { useVoiceStore } from '../../store/voiceStore';\nimport { BrowserSpeechEngine } from '../../services/speech/BrowserSpeechEngine';");
}

// State
code = code.replace(/const \[audioEnabled, setAudioEnabled\] = useState\(false\);\n?/, '');
code = code.replace(/const audioEnabledRef = useRef\(audioEnabled\);\n\s*useEffect\(\(\) => \{\n\s*audioEnabledRef.current = audioEnabled;\n\s*\}, \[audioEnabled\]\);\n?/, '');

// Add hook
code = code.replace("const [clinicProfile, setClinicProfile] = useState<any>(null);", "const [clinicProfile, setClinicProfile] = useState<any>(null);\n  const { enabled: audioEnabled, setEnabled: setAudioEnabled } = useVoiceStore();");

// playTTS removal
const pttsStart = code.indexOf("const playTTS = (text: string");
if (pttsStart !== -1) {
  let depth = 0;
  let pttsEnd = -1;
  for (let i = pttsStart; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) {
        pttsEnd = i + 1;
        break;
      }
    }
  }
  if (pttsEnd !== -1) {
    code = code.slice(0, pttsStart) + code.slice(pttsEnd);
  }
}

// Button replacement
const btnTarget = `playTTS('Đã kích hoạt trợ lý âm thanh Dental Smart.', true);`;
code = code.replace(btnTarget, `BrowserSpeechEngine.speak('Đã kích hoạt trợ lý âm thanh Dental Smart.');`);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', code);
