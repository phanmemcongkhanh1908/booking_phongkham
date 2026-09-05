const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/components/PrintTemplates.tsx', 'utf8');
content = content.replace(/position: 'absolute', \s*left: '-9999px', \s*top: '-9999px'/g, "");
fs.writeFileSync('src/pages/admin/components/PrintTemplates.tsx', content);

let patients = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

patients = patients.replace(
  '<div className="print:hidden">', 
  '<div className="print:hidden absolute left-[-9999px] top-[-9999px]">'
);

fs.writeFileSync('src/pages/admin/Patients.tsx', patients);
