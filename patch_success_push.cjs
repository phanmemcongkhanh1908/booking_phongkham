const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

if (!content.includes('PushNotificationPrompt')) {
    content = content.replace("import { CheckCircle2, Calendar, MapPin, Phone, User, Clock, Download, X, Mail, Send, RefreshCw, QrCode } from 'lucide-react';",
    "import { CheckCircle2, Calendar, MapPin, Phone, User, Clock, Download, X, Mail, Send, RefreshCw, QrCode } from 'lucide-react';\nimport { PushNotificationPrompt } from './PushNotificationPrompt';");

    const targetStr = `{/* Action Navigation */}`;
    const replacementStr = `<PushNotificationPrompt phone={ticket?.patientPhone || ''} />\n      \n      {/* Action Navigation */}`;
    content = content.replace(targetStr, replacementStr);
    
    fs.writeFileSync('src/pages/public/components/SuccessView.tsx', content);
}
