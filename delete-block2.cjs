const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

const regex = /\{\/\* ======================================================== \*\/\}\n\s*\{\/\* PRINT VIEWS[\s\S]*?<\/div>\n\n\s*\{\/\* Document Viewer Modal \*\/\}/g;

content = content.replace(regex, "{/* Document Viewer Modal */}");
fs.writeFileSync('src/pages/admin/Patients.tsx', content);
