const fs = require('fs');
const path = 'src/pages/public/components/DateTimeSelection.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    "import { format, addDays, startOfToday } from 'date-fns';",
    "import { format, addDays, startOfToday } from 'date-fns';\nimport { useNavigate } from 'react-router-dom';"
  );
}

fs.writeFileSync(path, content);
