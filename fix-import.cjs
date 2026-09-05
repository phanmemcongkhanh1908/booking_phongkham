const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

if (!content.includes("import DocumentViewer")) {
  content = content.replace(
    "import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';",
    "import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';\nimport DocumentViewer from './components/DocumentViewer';"
  );
  fs.writeFileSync('src/pages/admin/Patients.tsx', content);
}
