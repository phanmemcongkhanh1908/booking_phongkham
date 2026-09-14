const fs = require('fs');

const f1 = 'server/services/urlShortener.ts';
let code1 = fs.readFileSync(f1, 'utf8');
code1 = code1.replace("id: 'internal' | 'dagd' | 'tinyurl' | 'full';", "id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';");
fs.writeFileSync(f1, code1);

const f2 = 'src/pages/admin/UsersManagement.tsx';
let code2 = fs.readFileSync(f2, 'utf8');
code2 = code2.replace("id: 'internal' | 'dagd' | 'tinyurl' | 'full';", "id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';");
fs.writeFileSync(f2, code2);

console.log('Fixed interface types');
