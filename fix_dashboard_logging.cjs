const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'console.error("Failed to load appointments", error);',
  'if (error.response?.status !== 401) { console.error("Failed to load appointments", error); }'
);

content = content.replace(
  'console.error("Failed to load patients", error);',
  'if (error.response?.status !== 401) { console.error("Failed to load patients", error); }'
);

fs.writeFileSync(path, content);
