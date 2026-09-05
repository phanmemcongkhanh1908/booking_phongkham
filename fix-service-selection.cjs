const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/ServiceSelection.tsx', 'utf8');

content = content.replace(/<div\s+key=\{svc\.id\}\s+onClick=\{/g, '<button key={svc.id} onClick={');
content = content.replace(/<\/div>\s*\}\)\}\s*<\/CardContent>/g, '</button>\n        ))}\n      </CardContent>');

// Add type="button" and text-left w-full
content = content.replace(/className="group relative flex cursor-pointer/g, 'type="button" className="group text-left w-full relative flex cursor-pointer');

fs.writeFileSync('src/pages/public/components/ServiceSelection.tsx', content);
