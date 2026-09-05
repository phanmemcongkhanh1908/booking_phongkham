const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/components/PrintTemplates.tsx', 'utf8');

content = content.replace(
  'className="bg-white text-slate-800 font-sans mx-auto shadow-sm"',
  'className="bg-white text-slate-800 font-sans mx-auto shadow-sm relative"'
);

fs.writeFileSync('src/pages/admin/components/PrintTemplates.tsx', content);

