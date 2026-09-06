const fs = require('fs');
const path = 'src/pages/admin/Patients.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import.meta.env.VITE_GOOGLE_CLIENT_ID",
  "(import.meta as any).env.VITE_GOOGLE_CLIENT_ID"
);

content = content.replace(/setTelegramIdInput\(/g, "// setTelegramIdInput(");
content = content.replace(/setShowTelegramModal\(/g, "// setShowTelegramModal(");

fs.writeFileSync(path, content);
