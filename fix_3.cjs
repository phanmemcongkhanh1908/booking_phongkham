const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const returnTarget = `  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full overflow-x-hidden">`;

const fixFunctions = `
  const handleAddNote = () => {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full overflow-x-hidden">`;

if (code.includes(returnTarget)) {
  code = code.replace(returnTarget, fixFunctions);
  fs.writeFileSync('src/pages/admin/Settings.tsx', code);
  console.log('Force appended functions successfully');
} else {
  console.log('Still could not find return target');
}
