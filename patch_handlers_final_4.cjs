const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const targetStr = `  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (bookingFormConfig.quickNotesTags.includes(trimmed)) {
      return;
    }
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: [...prev.quickNotesTags, trimmed]
    }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter((t: string) => t !== tag)
    }));
  };`;

const replaceStr = `  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (bookingFormConfig.quickNotesTags.includes(trimmed)) {
      return;
    }
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: [...prev.quickNotesTags, trimmed]
    }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
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

if (!code.includes('const handleAddNote = () => {')) {
  code = code.replace(targetStr, replaceStr);
}

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Final attempt to add handlers');
