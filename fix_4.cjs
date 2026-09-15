const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

// The return statement wasn't found before because there were extra spaces or something.
// Let's just find `const handleSaveClinic = async (e: React.FormEvent) => {` and insert our functions before it.

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

if (code.includes(target)) {
  code = code.replace(target, inject);
  fs.writeFileSync('src/pages/admin/Settings.tsx', code);
  console.log('Force appended functions successfully 4');
} else {
  console.log('Could not find target');
}
