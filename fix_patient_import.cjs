const fs = require('fs');
const path = 'src/pages/public/components/PatientForm.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    "import { format } from 'date-fns';",
    "import { format } from 'date-fns';\nimport { useNavigate } from 'react-router-dom';"
  );
}

fs.writeFileSync(path, content);
