const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/components/PrintTemplates.tsx', 'utf8');
content = content.replace(/boxSizing: 'border-box',/g, "boxSizing: 'border-box',\n        position: 'absolute',\n        left: '-9999px',\n        top: '-9999px'");
// We want the print instances (rendered in the window.print div) to NOT be absolute.
// Wait, we can just add a prop `isPrintNode` or `className="print-override"`.
// Let's pass a prop `forPrint={true}` in Patients.tsx where it's for printing.

content = content.replace(/export const ReceiptTemplate = forwardRef<HTMLDivElement, { patient: any, total: number, paid: number, newDebt: number, oldDebt: number }>\(\({ patient, total, paid, newDebt, oldDebt }, ref\) => {/g, "export const ReceiptTemplate = forwardRef<HTMLDivElement, { patient: any, total: number, paid: number, newDebt: number, oldDebt: number, forPrint?: boolean }>(({ patient, total, paid, newDebt, oldDebt, forPrint = false }, ref) => {");

content = content.replace(/export const MedicalRecordTemplate = forwardRef<HTMLDivElement, { patient: any, records: any\[\] }>\(\({ patient, records }, ref\) => {/g, "export const MedicalRecordTemplate = forwardRef<HTMLDivElement, { patient: any, records: any[], forPrint?: boolean }>(({ patient, records, forPrint = false }, ref) => {");

// Apply conditional styling
content = content.replace(/position: 'absolute',\s*left: '-9999px',\s*top: '-9999px'/g, "...(forPrint ? {} : { position: 'absolute', left: '-9999px', top: '-9999px' })");
fs.writeFileSync('src/pages/admin/components/PrintTemplates.tsx', content);

// Now update Patients.tsx
let patients = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');
// Revert the wrapper change
patients = patients.replace('<div className="print:hidden absolute left-[-9999px] top-[-9999px]">', '<div className="print:hidden">');

// Add forPrint={true} to the print blocks
patients = patients.replace(
  '<ReceiptTemplate \n            patient={selectedPatient} \n            total={currentServiceCost}',
  '<ReceiptTemplate \n            forPrint={true}\n            patient={selectedPatient} \n            total={currentServiceCost}'
);
patients = patients.replace(
  '<MedicalRecordTemplate \n            patient={selectedPatient} \n            records={selectedPatient.emr || []} \n          />',
  '<MedicalRecordTemplate \n            forPrint={true}\n            patient={selectedPatient} \n            records={selectedPatient.emr || []} \n          />'
);

fs.writeFileSync('src/pages/admin/Patients.tsx', patients);
