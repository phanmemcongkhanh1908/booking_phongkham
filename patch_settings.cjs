const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const targetState = `  const [bookingFormConfig, setBookingFormConfig] = useState({
    uiVersion: 'full', // 'full' | 'simple'
    showNotificationChannels: true,
    showHoldCountdown: true,
    quickNotesTags: DEFAULT_TAGS,
  });

  const [newTagInput, setNewTagInput] = useState('');`;

const replaceState = `  const DEFAULT_PRE_VISIT_NOTES = [
    'Vui lòng mang theo **CCCD / Căn cước** hoặc **BHYT** (nếu có) để đối chiếu thông tin và làm thủ tục hành chính nhanh chóng.',
    'Quý khách nên có mặt trước giờ hẹn **10 phút** để nhân viên lễ tân hỗ trợ chuẩn bị hồ sơ y tế tốt nhất.',
    'Vì lý do chuyên môn, nếu quý khách đến trễ quá 15 phút, phòng khám có thể sẽ linh động sắp xếp khung giờ tiếp theo để không ảnh hưởng đến bệnh nhân khác.',
    'Nếu có thay đổi, vui lòng thông báo hủy hoặc dời lịch trước **24h** qua hotline.'
  ];

  const [bookingFormConfig, setBookingFormConfig] = useState({
    uiVersion: 'full', // 'full' | 'simple'
    showNotificationChannels: true,
    showHoldCountdown: true,
    quickNotesTags: DEFAULT_TAGS,
    preVisitNotes: DEFAULT_PRE_VISIT_NOTES,
  });

  const [newTagInput, setNewTagInput] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');`;

code = code.replace(targetState, replaceState);

const targetHandlers = `  const handleRemoveTag = (tag: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter((t: string) => t !== tag)
    }));
  };`;

const replaceHandlers = `  const handleRemoveTag = (tag: string) => {
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

code = code.replace(targetHandlers, replaceHandlers);

const targetUI = `                </div>
              </div>
            </div>

            {/* Live Preview Box */}`;

const replaceUI = `                </div>
              </div>
            </div>

            {/* Mục 4: Lưu ý trước khi đến khám (Bước 5 - Hoàn tất) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold text-slate-800">
                      Lưu ý trước khi đến khám (Vé khám điện tử)
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Tuỳ biến danh sách các lưu ý, dặn dò hoặc chính sách phòng khám hiển thị tại Bước 5 (Hoàn tất đặt hẹn). Hỗ trợ Markdown (dùng **in đậm**).
                  </p>
                </div>
              </div>

              {/* Danh sách các lưu ý hiện tại */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Các lưu ý đang hiển thị ({bookingFormConfig.preVisitNotes?.length || 0}):</label>
                <div className="flex flex-col gap-2">
                  {bookingFormConfig.preVisitNotes?.map((note: string, i: number) => (
                    <div key={i} className="flex items-start justify-between gap-2 py-2 px-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 shadow-sm transition-all group">
                      <div className="flex-1 flex gap-2">
                        <span className="text-teal-600 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{note}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNote(note)}
                        className="p-1 -m-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                        title="Xóa lưu ý này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form thêm lưu ý mới */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Thêm lưu ý mới:</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    type="text"
                    placeholder="VD: Quý khách vui lòng ăn nhẹ trước khi đến nhổ răng..."
                    value={newNoteInput || ''}
                    onChange={e => setNewNoteInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    className="flex-1 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    onClick={handleAddNote}
                    variant="outline"
                    className="shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold text-teal-700 border-teal-300 hover:bg-teal-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-teal-600" />
                    Thêm lưu ý
                  </Button>
                </div>
              </div>
            </div>

            {/* Live Preview Box */}`;

code = code.replace(targetUI, replaceUI);

fs.writeFileSync('src/pages/admin/Settings.tsx', code);
console.log('Settings.tsx patched');
