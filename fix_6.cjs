const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

// Use simple string replacement to get rid of duplicate declarations
code = code.split('const handleAddNote = () => {')[0] + `
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

  const handleSaveClinic = async (e: React.FormEvent) => {` + code.split('const handleSaveClinic = async (e: React.FormEvent) => {')[1];

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Force re-built handlers properly');
