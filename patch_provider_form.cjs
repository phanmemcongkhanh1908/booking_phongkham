const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ServicesConfig.tsx', 'utf8');

const target = `                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block">Chuyên khoa</label>
                  <Input placeholder="VD: Chuyên khoa Răng Hàm Mặt" value={editingProvider.specialty || ''} onChange={e => setEditingProvider({...editingProvider, specialty: e.target.value})} />
                </div>`;

const extraFields = `
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block">Kinh nghiệm</label>
                  <Input placeholder="VD: 10 năm kinh nghiệm" value={editingProvider.experience || ''} onChange={e => setEditingProvider({...editingProvider, experience: e.target.value})} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block">Thế mạnh chuyên môn (Tags)</label>
                  <Input 
                    placeholder="VD: CHỈNH NHA, IMPLANT NHA KHOA (cách nhau bằng dấu phẩy)" 
                    value={(editingProvider.specialties || []).join(', ')} 
                    onChange={e => setEditingProvider({...editingProvider, specialties: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Các tag này hiển thị nổi bật dưới tên bác sĩ.</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block">Bằng cấp & Chứng chỉ</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                    placeholder="Mỗi dòng một chứng chỉ&#10;VD: Chứng chỉ Cấy ghép Implant (Bộ Y Tế)"
                    value={(editingProvider.certificates || []).join('\\n')}
                    onChange={e => setEditingProvider({...editingProvider, certificates: e.target.value.split('\\n').filter(Boolean)})}
                  ></textarea>
                </div>
`;

content = content.replace(target, target + extraFields);
fs.writeFileSync('src/pages/admin/ServicesConfig.tsx', content);
