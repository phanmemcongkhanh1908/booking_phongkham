const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const targetStr = `  const handleSaveBookingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFormLoading(true);
    setBookingFormMsg('');
    try {
      await api.post('/admin/settings', { bookingFormConfig });
      setBookingFormMsg('✅ Lưu cấu hình trang Hồ Sơ Tiếp Đón thành công!');
      setTimeout(() => setBookingFormMsg(''), 4000);
    } catch (err: any) {
      setBookingFormMsg('❌ ' + (err.response?.data?.error?.message || 'Có lỗi xảy ra khi lưu'));
    } finally {
      setBookingFormLoading(false);
    }
  };`;

const replaceStr = `  const handleSaveBookingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFormLoading(true);
    setBookingFormMsg('');
    try {
      await api.post('/admin/settings', { bookingFormConfig });
      setBookingFormMsg('✅ Lưu cấu hình trang Hồ Sơ Tiếp Đón thành công!');
      setTimeout(() => setBookingFormMsg(''), 4000);
    } catch (err: any) {
      setBookingFormMsg('❌ ' + (err.response?.data?.error?.message || 'Có lỗi xảy ra khi lưu'));
    } finally {
      setBookingFormLoading(false);
    }
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

if (!code.includes('handleAddNote')) {
  code = code.replace(targetStr, replaceStr);
}

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Settings handlers TS patched again for real');
