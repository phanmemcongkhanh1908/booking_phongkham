const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

content = content.replace(/import \{ toPng \}import \{ PushNotificationPrompt \}.*?'html-to-image';/g, "import { toPng } from 'html-to-image';\nimport { PushNotificationPrompt } from './PushNotificationPrompt';");

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', content);
