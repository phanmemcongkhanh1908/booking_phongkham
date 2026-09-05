const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// Add import
content = content.replace(
  "import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';",
  "import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';\nimport DocumentViewer from './components/DocumentViewer';"
);

// Replace state variables
content = content.replace(
  /const \[printType, setPrintType\] = useState<'receipt' | 'record' | null>\(null\);[\s\S]*?const \[telegramFormat, setTelegramFormat\] = useState<'png' | 'pdf'>\('png'\);/m,
  "const [documentViewerState, setDocumentViewerState] = useState<{isOpen: boolean, type: 'receipt' | 'record' | null}>({isOpen: false, type: null});"
);

// Remove handleSendTelegram and old print effect
content = content.replace(
  /\/\/ Handle printing by hiding other elements[\s\S]*?const handleSendTelegram = async \(\) => {[\s\S]*?setSendingTelegram\(false\);\n    }\n  };/m,
  ""
);

// Remove refs
content = content.replace(/const receiptRef = React.useRef<HTMLDivElement>\(null\);\n  const recordRef = React.useRef<HTMLDivElement>\(null\);/m, "");

// Update print button click
content = content.replace(
  /onClick=\{\(\) => setPrintType\('receipt'\)\}/g,
  "onClick={() => setDocumentViewerState({ isOpen: true, type: 'receipt' })}"
);
content = content.replace(
  /onClick=\{\(\) => setPrintType\('record'\)\}/g,
  "onClick={() => setDocumentViewerState({ isOpen: true, type: 'record' })}"
);

// Update telegram button click to just open the document viewer
content = content.replace(
  /onClick=\{\(\) => {\s*setTelegramIdInput\(selectedPatient\?\.telegramId \|\| ''\);\s*setShowTelegramModal\('receipt'\);\s*}\}/g,
  "onClick={() => setDocumentViewerState({ isOpen: true, type: 'receipt' })}"
);
content = content.replace(
  /onClick=\{\(\) => {\s*setTelegramIdInput\(selectedPatient\?\.telegramId \|\| ''\);\s*setShowTelegramModal\('record'\);\s*}\}/g,
  "onClick={() => setDocumentViewerState({ isOpen: true, type: 'record' })}"
);

// Remove the old templates rendering block
content = content.replace(
  /\{\/\* Print Templates rendered directly into the DOM \*\/\}\s*<div className="print:block hidden">[\s\S]*?<\/div>\s*\{\/\* Hidden templates for html2canvas to capture \*\/\}\s*<div className="print:hidden">[\s\S]*?<\/div>\s*\{\/\* ======================================================== \*\/\}\s*\{\/\* TELEGRAM MODAL                                           \*\/\}\s*\{\/\* ======================================================== \*\/\}\s*\{showTelegramModal && \([\s\S]*?\}\)/m,
  ""
);

// Actually wait, let me just find those specific strings and remove them safely.
