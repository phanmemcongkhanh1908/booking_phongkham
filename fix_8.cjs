const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

// The issue is they were already declared multiple times because I kept appending them
// We must find ALL 'const handleAddNote' blocks and remove them

let attempts = 0;
while (code.includes('const handleAddNote = () => {')) {
  const start = code.indexOf('const handleAddNote = () => {');
  const end = code.indexOf(';', code.indexOf('setNewNoteInput(\'\');', start)) + 1;
  code = code.substring(0, start) + code.substring(end);
  attempts++;
  if (attempts > 10) break;
}

attempts = 0;
while (code.includes('const handleRemoveNote = (note: string) => {')) {
  const start = code.indexOf('const handleRemoveNote = (note: string) => {');
  const end = code.indexOf(';', code.indexOf('}));', start)) + 1;
  // Account for the closing brace
  const endReal = code.indexOf('};', end) + 2;
  code = code.substring(0, start) + code.substring(endReal);
  attempts++;
  if (attempts > 10) break;
}

const target = `  const handleSaveClinic = async (e: React.FormEvent) => {`;
const inject = `  const handleAddNote = () => {
    const trimmed = newNoteInput.trim();
    if (!trimmed) return;
    if ((bookingFormConfig.preVisitNotes || []).includes(trimmed)) return;
    
    setBookingFormConfig(prev => ({
      ...prev,
      preVisitNotes: [...(prev.preVisitNotes || []), trimmed]
    }));
    setNewNoteInput('');
  };

  const handleRemoveNote = (note: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      preVisitNotes: (prev.preVisitNotes || []).filter((n: string) => n !== note)
    }));
  };

  const handleSaveClinic = async (e: React.FormEvent) => {`;

code = code.replace(target, inject);

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Force re-built handlers with brute force removal');
