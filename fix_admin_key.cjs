const fs = require('fs');
const path = 'server/api/admin/index.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'settingsObj[s.key] = s.value;',
  'settingsObj[s.id] = s.value;'
);

fs.writeFileSync(path, content);
