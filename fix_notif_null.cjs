const fs = require('fs');
const path = 'src/components/NotificationManager.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "if (apt.status === 'CONFIRMED' || apt.status === 'REQUESTED') {",
  "if ((apt.status === 'CONFIRMED' || apt.status === 'REQUESTED') && apt.startAt) {"
);

fs.writeFileSync(path, content);
