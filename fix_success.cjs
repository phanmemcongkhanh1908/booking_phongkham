const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

if (!content.includes("import { PushNotificationPrompt }")) {
    content = content.replace("import { toPng }", "import { toPng }\nimport { PushNotificationPrompt } from './PushNotificationPrompt';");
}

content = content.replace("ticket?.patientPhone", "patientPhone");

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', content);
