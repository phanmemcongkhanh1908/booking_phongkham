const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

const lines = content.split('\n');
const newLines = lines.map(l => {
    if (l.includes("import { toPng }import { PushNotificationPrompt }")) {
        return "import { toPng } from 'html-to-image';\nimport { PushNotificationPrompt } from './PushNotificationPrompt';";
    }
    return l;
});

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', newLines.join('\n'));
