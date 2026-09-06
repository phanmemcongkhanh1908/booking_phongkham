const fs = require('fs');
const path = 'src/components/NotificationManager.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'console.error("Failed to fetch admin notifications", error);',
  'if (error.response?.status !== 401) { console.error("Failed to fetch admin notifications", error); }'
);

fs.writeFileSync(path, content);
