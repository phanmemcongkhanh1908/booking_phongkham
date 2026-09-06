const fs = require('fs');
const path = 'server/api/public/index.ts';
let content = fs.readFileSync(path, 'utf8');

const s10Fix = `
      if (patientRecords.length > 0) {
        patientId = patientRecords[0].id;
        
        // Append notes without overwriting other personal details to prevent data corruption for shared phone numbers
        await tx.update(patients).set({
          notes: patientNotes
        }).where(eq(patients.id, patientId));
`;

content = content.replace(
  /if \(patientRecords\.length > 0\) \{\n\s*patientId = patientRecords\[0\]\.id;\n\s*\/\/ Update patient info if provided\n\s*await tx\.update\(patients\)\.set\(\{\n\s*fullName: data\.fullName,\n\s*dob: data\.dob \|\| patientRecords\[0\]\.dob,\n\s*gender: data\.gender \|\| patientRecords\[0\]\.gender,\n\s*telegramId: data\.telegramId \|\| patientRecords\[0\]\.telegramId,\n\s*notes: patientNotes\n\s*\}\)\.where\(eq\(patients\.id, patientId\)\);/m,
  s10Fix
);

fs.writeFileSync(path, content);
