const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/components/DocumentViewer.tsx', 'utf8');

// Add K80ReceiptTemplate to imports
content = content.replace(
  "import { ReceiptTemplate, MedicalRecordTemplate } from './PrintTemplates';",
  "import { ReceiptTemplate, K80ReceiptTemplate, MedicalRecordTemplate } from './PrintTemplates';"
);

// Add printFormat state
content = content.replace(
  "const [telegramSuccess, setTelegramSuccess] = useState('');",
  "const [telegramSuccess, setTelegramSuccess] = useState('');\n  const [printFormat, setPrintFormat] = useState<'a5' | 'k80'>('a5');"
);

// Replace ReceiptTemplate rendering with dynamic K80/A5
const renderReceiptPreview = `
                {type === 'receipt' ? (
                  printFormat === 'a5' ? (
                    <ReceiptTemplate 
                      forPrint={true} 
                      patient={patient}
                      total={receiptData.total}
                      paid={receiptData.paid}
                      newDebt={receiptData.newDebt}
                      oldDebt={receiptData.oldDebt}
                    />
                  ) : (
                    <div className="bg-white shadow-xl max-w-sm mx-auto">
                      <K80ReceiptTemplate 
                        forPrint={true} 
                        patient={patient}
                        total={receiptData.total}
                        paid={receiptData.paid}
                        newDebt={receiptData.newDebt}
                        oldDebt={receiptData.oldDebt}
                      />
                    </div>
                  )
                ) : (
`;

content = content.replace(
  /\{type === 'receipt' \? \([\s\S]*?<ReceiptTemplate[\s\S]*?\/>\s*\) : \(/m,
  renderReceiptPreview
);

// Replace hidden templates for html2canvas
const renderHiddenTemplates = `
        {type === 'receipt' ? (
          printFormat === 'a5' ? (
            <ReceiptTemplate 
              ref={targetRef}
              patient={patient}
              total={receiptData.total}
              paid={receiptData.paid}
              newDebt={receiptData.newDebt}
              oldDebt={receiptData.oldDebt}
            />
          ) : (
            <K80ReceiptTemplate 
              ref={targetRef}
              patient={patient}
              total={receiptData.total}
              paid={receiptData.paid}
              newDebt={receiptData.newDebt}
              oldDebt={receiptData.oldDebt}
            />
          )
        ) : (
`;

content = content.replace(
  /\{type === 'receipt' \? \([\s\S]*?<ReceiptTemplate[\s\S]*?ref=\{targetRef\}[\s\S]*?\/>\s*\) : \(/m,
  renderHiddenTemplates
);

// Replace print block templates
const renderPrintTemplates = `
          {type === 'receipt' ? (
            printFormat === 'a5' ? (
              <ReceiptTemplate 
                forPrint={true} 
                patient={patient}
                total={receiptData.total}
                paid={receiptData.paid}
                newDebt={receiptData.newDebt}
                oldDebt={receiptData.oldDebt}
              />
            ) : (
              <K80ReceiptTemplate 
                forPrint={true} 
                patient={patient}
                total={receiptData.total}
                paid={receiptData.paid}
                newDebt={receiptData.newDebt}
                oldDebt={receiptData.oldDebt}
              />
            )
          ) : (
`;

content = content.replace(
  /\{type === 'receipt' \? \([\s\S]*?<ReceiptTemplate[\s\S]*?forPrint=\{true\}[\s\S]*?\/>\s*\) : \(/m,
  renderPrintTemplates
);


// Add a select option to header toolbar if type === 'receipt'
const selectFormatStr = `
            <div className="flex items-center gap-3">
              {type === 'receipt' && (
                <div className="flex bg-slate-100 p-1 rounded-md">
                  <button onClick={() => setPrintFormat('a5')} className={\`px-3 py-1.5 text-xs font-medium rounded \${printFormat === 'a5' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}\`}>A5 (Chuẩn)</button>
                  <button onClick={() => setPrintFormat('k80')} className={\`px-3 py-1.5 text-xs font-medium rounded \${printFormat === 'k80' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}\`}>K80 (Máy in bill)</button>
                </div>
              )}
              <Button variant="outline" onClick={handlePrint} className="gap-2 bg-white hidden sm:flex">
`;

content = content.replace(
  /<div className="flex items-center gap-3">\s*<Button variant="outline" onClick=\{handlePrint\} className="gap-2 bg-white hidden sm:flex">/,
  selectFormatStr
);

fs.writeFileSync('src/pages/admin/components/DocumentViewer.tsx', content);
