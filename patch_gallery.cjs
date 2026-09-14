const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// 1. Add Gallery Icon import
content = content.replace(
  "import { \n  Search,\n  Plus,\n  MoreVertical,\n  Calendar,\n  Phone,\n  Mail,\n  FileText,\n  Activity,\n  ChevronRight,\n  UploadCloud,\n  Images,\n  CheckCircle2,\n  XCircle,\n  CalendarClock,\n  Image as ImageIcon,",
  "import { \n  Search,\n  Plus,\n  MoreVertical,\n  Calendar,\n  Phone,\n  Mail,\n  FileText,\n  Activity,\n  ChevronRight,\n  UploadCloud,\n  Images,\n  CheckCircle2,\n  XCircle,\n  CalendarClock,\n  Image as ImageIcon,\n  Sparkles,"
);

// 2. Add Tab Button
const tabButtonStr = `
              <button 
                onClick={() => setActiveTab('gallery')}
                className={\`py-3 px-4 text-xs font-bold flex items-center border-b-2 transition-all \${
                  activeTab === 'gallery' 
                    ? 'border-primary text-primary bg-surface shadow-xs rounded-t-lg' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }\`}
              >
                <Sparkles className="w-4 h-4 mr-2 shrink-0 text-primary" />
                Thư viện Trước & Sau
              </button>
            </div>`;
content = content.replace("            </div>\n\n            {/* TAB CONTENTS */}", tabButtonStr + "\n\n            {/* TAB CONTENTS */}");

// 3. Add Tab Content
const tabContentStr = `
              {/* ======================================================== */}
              {/* TAB 5: GALLERY (BEFORE & AFTER) */}
              {/* ======================================================== */}
              {activeTab === 'gallery' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Thư viện Trước & Sau</h3>
                      <p className="text-sm text-slate-500">Quản lý và trình chiếu kết quả điều trị trực quan cho bệnh nhân.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm">
                      <Plus className="w-4 h-4" />
                      Thêm ca mới
                    </button>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {['Tất cả', 'Niềng răng - Chỉnh nha', 'Implant', 'Răng sứ thẩm mỹ', 'Tẩy trắng răng'].map((cat, i) => (
                      <button key={i} className={\`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition-colors \${i === 0 ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}\`}>
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Gallery Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Item 1 */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider rounded-md">Niềng răng</span>
                          <span className="text-xs font-semibold text-slate-600">Mắc cài sứ tự động (18 tháng)</span>
                        </div>
                        <button className="text-slate-400 hover:text-slate-700 p-1"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-100">
                        <div className="relative group">
                          <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center p-4">
                            <ImageIcon className="w-8 h-8 text-slate-300" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                            <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">Trước</span>
                          </div>
                        </div>
                        <div className="relative group">
                          <div className="aspect-[4/3] bg-teal-50 flex items-center justify-center p-4">
                            <ImageIcon className="w-8 h-8 text-teal-200" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                            <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">Sau</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 text-xs text-slate-500 bg-white border-t border-slate-100 flex items-center justify-between">
                        <span>Hoàn thành: 12/08/2023</span>
                        <button className="text-teal-600 font-semibold hover:underline">Chi tiết</button>
                      </div>
                    </div>
                    
                    {/* Item 2 */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider rounded-md">Răng sứ</span>
                          <span className="text-xs font-semibold text-slate-600">Bọc 16 răng sứ Cercon HT</span>
                        </div>
                        <button className="text-slate-400 hover:text-slate-700 p-1"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-100">
                        <div className="relative group">
                          <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center p-4">
                            <ImageIcon className="w-8 h-8 text-slate-300" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                            <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">Trước</span>
                          </div>
                        </div>
                        <div className="relative group">
                          <div className="aspect-[4/3] bg-indigo-50 flex items-center justify-center p-4">
                            <ImageIcon className="w-8 h-8 text-indigo-200" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                            <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">Sau</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 text-xs text-slate-500 bg-white border-t border-slate-100 flex items-center justify-between">
                        <span>Hoàn thành: 05/01/2024</span>
                        <button className="text-indigo-600 font-semibold hover:underline">Chi tiết</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Empty State / Call to Action */}
                  <div className="mt-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <Sparkles className="w-5 h-5 text-slate-400" />
                    </div>
                    <h4 className="font-bold text-slate-700 mb-1">Xây dựng thư viện nụ cười</h4>
                    <p className="text-sm text-slate-500 max-w-sm mb-4">Lưu lại hành trình thay đổi của bệnh nhân để trình chiếu và tư vấn hiệu quả hơn cho các ca tương tự.</p>
                    <button className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline">Tìm hiểu cách chụp ảnh chuẩn y khoa</button>
                  </div>
                </div>
              )}
`;

content = content.replace("{/* TAB CONTENTS */}\n            <div className=\"flex-1 overflow-y-auto bg-bg-base p-4 lg:p-6\">", "{/* TAB CONTENTS */}\n            <div className=\"flex-1 overflow-y-auto bg-bg-base p-4 lg:p-6\">\n" + tabContentStr);

fs.writeFileSync('src/pages/admin/Patients.tsx', content);
