const fs = require('fs');
const path = 'server/core/security.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'return jwt.verify(token, JWT_SECRET) as TokenPayload;',
  'return jwt.verify(token, SECRET) as TokenPayload;'
);

fs.writeFileSync(path, content);
