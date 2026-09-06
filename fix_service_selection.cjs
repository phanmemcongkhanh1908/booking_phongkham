const fs = require('fs');
const path = 'src/pages/public/components/ServiceSelection.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace(
    "import { ChevronRight, Stethoscope, Sparkles } from 'lucide-react';",
    "import { ChevronRight, Stethoscope, Sparkles } from 'lucide-react';\nimport { useNavigate } from 'react-router-dom';"
  );
}

if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace(
    'const setService = useBookingStore(state => state.setService);',
    'const setService = useBookingStore(state => state.setService);\n  const navigate = useNavigate();'
  );
}

content = content.replace(
  'onClick={() => setService(svc.id, svc.name)}',
  'onClick={() => { setService(svc.id, svc.name); navigate(\'/book/chon-gio\'); }}'
);

fs.writeFileSync(path, content);
