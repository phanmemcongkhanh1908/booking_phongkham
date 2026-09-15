const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const tsErrorType = `  const [bookingFormConfig, setBookingFormConfig] = useState({
    uiVersion: 'full', // 'full' | 'simple'
    showNotificationChannels: true,
    showHoldCountdown: true,
    quickNotesTags: DEFAULT_TAGS,
  });`;

const tsFixType = `  const DEFAULT_PRE_VISIT_NOTES = [
    'Vui lòng mang theo **CCCD / Căn cước** hoặc **BHYT** (nếu có) để đối chiếu thông tin và làm thủ tục hành chính nhanh chóng.',
    'Quý khách nên có mặt trước giờ hẹn **10 phút** để nhân viên lễ tân hỗ trợ chuẩn bị hồ sơ y tế tốt nhất.',
    'Vì lý do chuyên môn, nếu quý khách đến trễ quá 15 phút, phòng khám có thể sẽ linh động sắp xếp khung giờ tiếp theo để không ảnh hưởng đến bệnh nhân khác.',
    'Nếu có thay đổi, vui lòng thông báo hủy hoặc dời lịch trước **24h** qua hotline.'
  ];

  const [bookingFormConfig, setBookingFormConfig] = useState<{
    uiVersion: string;
    showNotificationChannels: boolean;
    showHoldCountdown: boolean;
    quickNotesTags: string[];
    preVisitNotes?: string[];
  }>({
    uiVersion: 'full',
    showNotificationChannels: true,
    showHoldCountdown: true,
    quickNotesTags: DEFAULT_TAGS,
    preVisitNotes: DEFAULT_PRE_VISIT_NOTES,
  });

  const [newNoteInput, setNewNoteInput] = useState('');`;

code = code.replace(tsErrorType, tsFixType);

const tsErrorHandlers = `  const handleRemoveTag = (tag: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter((t: string) => t !== tag)
    }));
  };`;

const tsFixHandlers = `  const handleRemoveTag = (tag: string) => {
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

// Check if handlers are already added by previous script
if (!code.includes('handleAddNote = () => {')) {
  code = code.replace(tsErrorHandlers, tsFixHandlers);
}

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Settings.tsx final TS patched');
