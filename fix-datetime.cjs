const fs = require('fs');

let content = fs.readFileSync('src/pages/public/components/DateTimeSelection.tsx', 'utf8');

content = content.replace("endAt: slot.endAt,\n          new Date(res.data.data.expiresAt).getTime()\n      });", "endAt: slot.endAt\n      });");

content = content.replace("slot.endAt\n        );", "slot.endAt,\n          new Date(res.data.data.expiresAt).getTime()\n        );");

fs.writeFileSync('src/pages/public/components/DateTimeSelection.tsx', content);

