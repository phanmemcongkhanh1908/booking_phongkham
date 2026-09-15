const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const targetStr = `  const handleRemoveTag = (tag: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter((t: string) => t !== tag)
    }));
  };`;

const replaceStr = `  const handleRemoveTag = (tag: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter((t: string) => t !== tag)
    }));
  };

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
  };`;

// Check if handleAddNote exists globally
if (!code.includes('handleAddNote')) {
  code = code.replace(targetStr, replaceStr);
}

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Final TS patch for settings handlers');
