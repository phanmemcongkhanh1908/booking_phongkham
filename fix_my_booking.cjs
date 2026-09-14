const fs = require('fs');
let content = fs.readFileSync('src/pages/public/MyBooking.tsx', 'utf8');
content = content.replace(
  "import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft, Loader2, Edit3, XCircle } from 'lucide-react';",
  "import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft, Loader2, Edit3, XCircle } from 'lucide-react';\n"
);
fs.writeFileSync('src/pages/public/MyBooking.tsx', content);
