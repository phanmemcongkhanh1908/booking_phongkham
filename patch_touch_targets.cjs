const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

// The bottom submit button block usually looks like:
// <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
// Let's replace the buttons to be pb-safe and the close buttons to have larger touch targets.

code = code.replace(/<button type="button" onClick=\{\(\) => setUploadedFiles\(prev => prev.filter\(\(_, i\) => i !== idx\)\)\} className="font-medium text-rose-500 hover:text-rose-600">/g, 
  '<button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} className="p-2 -m-2 font-medium text-rose-500 hover:text-rose-600">');

const submitBtnTarget = `        <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">`;
const submitBtnReplace = `        <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4 pb-safe">`;

code = code.replace(submitBtnTarget, submitBtnReplace);
fs.writeFileSync('src/pages/public/components/PatientForm.tsx', code);

let cssCode = fs.readFileSync('src/index.css', 'utf8');
if (!cssCode.includes('pb-safe')) {
  cssCode += `\n\n@layer utilities {\n  .pb-safe {\n    padding-bottom: env(safe-area-inset-bottom, 20px);\n  }\n}\n`;
  fs.writeFileSync('src/index.css', cssCode);
}
console.log('Touch targets patched.');
