const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');
content = content.replace("import { toPng }import { PushNotificationPrompt } from './PushNotificationPrompt'; from 'html-to-image';", "import { toPng } from 'html-to-image';\nimport { PushNotificationPrompt } from './PushNotificationPrompt';");
fs.writeFileSync('src/pages/public/components/SuccessView.tsx', content);
