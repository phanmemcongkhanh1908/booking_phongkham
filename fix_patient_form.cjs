const fs = require('fs');
const path = 'src/pages/public/components/PatientForm.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    "import { format, parseISO } from 'date-fns';",
    "import { format, parseISO } from 'date-fns';\nimport { useNavigate } from 'react-router-dom';"
  );
}

if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace(
    'const { serviceId, providerId, sessionToken, slotStartTime, slotEndTime } = useBookingStore();',
    'const { serviceId, providerId, sessionToken, slotStartTime, slotEndTime } = useBookingStore();\n  const navigate = useNavigate();'
  );
}

content = content.replace(
  'appointmentData.telegramBotUsername\n          );\n        } else {',
  'appointmentData.telegramBotUsername\n          );\n          navigate(\'/book/hoan-tat\');\n        } else {'
);

fs.writeFileSync(path, content);
