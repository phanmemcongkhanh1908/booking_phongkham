const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf-8');

code = code.replace(/playTTS\(msgText\);/g, "import('../../services/speech/TTSQueueManager').then(m => m.TTSQueueManager.enqueue('msg_'+Date.now(), msgText));");

fs.writeFileSync('src/pages/admin/Dashboard.tsx', code);
