const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('pb-safe', 'pb-[env(safe-area-inset-bottom)]');

fs.writeFileSync(path, content);
console.log('Fixed safe area padding');
