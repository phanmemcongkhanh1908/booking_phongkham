const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');
const importsToAdd = `
import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';
import html2canvas from 'html2canvas';
`;
if (!content.includes('ReceiptTemplate } from')) {
  content = content.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';" + importsToAdd);
  fs.writeFileSync('src/pages/admin/Patients.tsx', content);
  console.log("Imports added!");
} else {
  console.log("Already added");
}
