const fs = require('fs');
let content = fs.readFileSync('src/pages/public/MyBooking.tsx', 'utf8');

content = content.replace(
  "const [loading, setLoading] = useState(true);",
  `const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const handleCancel = (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) return;
    setActionLoading(id);
    setTimeout(() => {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));
      setActionLoading(null);
    }, 1000);
  };
  
  const handleReschedule = (id: string) => {
    alert('Tính năng dời lịch đang được cập nhật. Cảm ơn bạn!');
  };`
);

content = content.replace(
  "import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft } from 'lucide-react';",
  "import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft, Loader2, Edit3, XCircle } from 'lucide-react';"
);

content = content.replace(
  "                    </div>\n                  </CardContent>\n                </Card>",
  `                    </div>
                  </CardContent>
                  {apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED' && (
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-xl">
                      <button 
                        disabled={actionLoading === apt.id}
                        onClick={() => handleCancel(apt.id)}
                        className="px-4 py-2 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {actionLoading === apt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Hủy lịch
                      </button>
                      <button 
                        onClick={() => handleReschedule(apt.id)}
                        className="px-4 py-2 text-xs font-semibold text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-4 h-4" />
                        Dời lịch khám
                      </button>
                    </div>
                  )}
                </Card>`
);

// We should also add a search lookup form.
content = content.replace(
  "<h1 className=\"text-2xl font-extrabold tracking-tight text-text-main\">\n            Lịch hẹn của tôi\n          </h1>\n        </header>",
  `<h1 className="text-2xl font-extrabold tracking-tight text-text-main">
            Lịch hẹn của tôi
          </h1>
        </header>

        {/* Idea 2: Lookup Form for Self-Reschedule */}
        <div className="mb-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-3">Tra cứu lịch hẹn</h3>
           <div className="flex gap-3">
             <input type="text" placeholder="Nhập số điện thoại của bạn..." className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all" />
             <input type="text" placeholder="Mã lịch hẹn (Tùy chọn)" className="w-48 hidden sm:block h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all" />
             <button className="h-11 px-5 bg-slate-800 text-white font-semibold text-[13px] rounded-xl hover:bg-slate-700 transition-colors whitespace-nowrap">Tra cứu</button>
           </div>
           <p className="text-[11px] text-slate-400 mt-2">Dùng số điện thoại để tra cứu, hủy hoặc dời lịch hẹn tự động.</p>
        </div>`
);

fs.writeFileSync('src/pages/public/MyBooking.tsx', content);
