const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/components/PrintTemplates.tsx', 'utf8');

const getNoteTextFn = `
const getNoteText = (notes: any) => {
  if (!notes) return 'Không';
  try {
    const parsed = JSON.parse(notes);
    return parsed.text || parsed.diagnosis || parsed.treatmentPlan || 'Không';
  } catch (e) {
    return notes;
  }
};
`;

if (!content.includes("const getNoteText")) {
  content = content.replace("export const ReceiptTemplate =", getNoteTextFn + "\nexport const ReceiptTemplate =");
}

content = content.replace(
  /\{patient\?\.notes \|\| 'Không'\}/g,
  "{getNoteText(patient?.notes)}"
);

fs.writeFileSync('src/pages/admin/components/PrintTemplates.tsx', content);

