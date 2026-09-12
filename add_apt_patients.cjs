const fs = require('fs');

const filePath = 'src/pages/admin/Patients.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add services state and loading
const stateMarker = 'const [showCreateDateModal, setShowCreateDateModal] = useState(false);';
const stateCode = `  const [showCreateDateModal, setShowCreateDateModal] = useState(false);
  const [showAddAptModal, setShowAddAptModal] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('');
  const [aptService, setAptService] = useState('');
  const [aptNotes, setAptNotes] = useState('');
  const [aptSubmitting, setAptSubmitting] = useState(false);

  useEffect(() => {
    if (showAddAptModal && services.length === 0) {
      api.get('/services').then(res => {
        if (res.data?.success) setServices(res.data.data);
      }).catch(console.error);
    }
  }, [showAddAptModal, services.length]);

  const handleCreateAppointment = async (e: any) => {
    e.preventDefault();
    if (!selectedPatient || !aptDate || !aptTime || !aptService) return;
    
    try {
      setAptSubmitting(true);
      const startAt = new Date(\`\${aptDate}T\${aptTime}:00\`);
      const endAt = new Date(startAt.getTime() + 30 * 60000); // 30 minutes default
      
      const payload = {
        patientId: selectedPatient.id,
        providerId: 'default', // Might be ignored or handled by backend
        serviceId: aptService,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        notes: aptNotes
      };
      
      const res = await api.post('/appointments/next', payload);
      if (res.data?.success) {
        setShowAddAptModal(false);
        setAptDate('');
        setAptTime('');
        setAptService('');
        setAptNotes('');
        alert('Đã đặt lịch hẹn thành công!');
        fetchPatientData(selectedPatient.id);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể đặt lịch hẹn. Vui lòng thử lại.');
    } finally {
      setAptSubmitting(false);
    }
  };
`;
content = content.replace(stateMarker, stateCode);

// 2. Modify the "Đặt lịch mới" button
const btnRegex = /<a[^>]*href="\/booking"[^>]*>[\s\S]*?<CalendarPlus[^>]*>[\s\S]*?Đặt lịch mới[\s\S]*?<\/a>/m;
const newBtn = `<button 
                        onClick={() => setShowAddAptModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-btn hover:bg-primary-dark transition-colors shadow-sm"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Đặt lịch mới
                      </button>`;
content = content.replace(btnRegex, newBtn);

// 3. Append the modal UI at the end of the return statement
const endMarker = '    </div>\n  );\n}';
const modalCode = `
      {/* Add Appointment Modal */}
      {showAddAptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">
                Đặt lịch hẹn mới
              </h3>
              <button 
                onClick={() => setShowAddAptModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="add-apt-form" onSubmit={handleCreateAppointment} className="space-y-4">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Bệnh nhân</p>
                  <p className="text-sm font-bold text-slate-800">{selectedPatient?.fullName}</p>
                  <p className="text-xs text-slate-500">{selectedPatient?.phone}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Dịch vụ điều trị <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={aptService}
                    onChange={e => setAptService(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  >
                    <option value="">-- Chọn dịch vụ --</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price?.toLocaleString()}đ</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Ngày hẹn <span className="text-red-500">*</span></label>
                    <input 
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={aptDate}
                      onChange={e => setAptDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Giờ hẹn <span className="text-red-500">*</span></label>
                    <input 
                      type="time"
                      required
                      value={aptTime}
                      onChange={e => setAptTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ghi chú (Không bắt buộc)</label>
                  <textarea 
                    rows={3}
                    placeholder="Nhập ghi chú cho bác sĩ..."
                    value={aptNotes}
                    onChange={e => setAptNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  ></textarea>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddAptModal(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                form="add-apt-form"
                type="submit"
                disabled={aptSubmitting}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70 shadow-sm"
              >
                {aptSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận đặt lịch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

content = content.replace(endMarker, modalCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated Patients.tsx");
