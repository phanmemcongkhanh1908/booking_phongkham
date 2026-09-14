const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ServicesConfig.tsx', 'utf8');

// We want to extract the form out of the inline list and make it look like a modal.
// First, add X icon to imports
content = content.replace("Trash2, Edit2, Plus, Clock, Settings2", "Trash2, Edit2, Plus, Clock, Settings2, X");

const formStr = `{showServiceForm && editingService && (
            <div className="mb-6 p-4 border border-border-subtle rounded-lg bg-bg-base relative">`;
            
const modalStr = `{showServiceForm && editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h4 className="font-bold text-slate-800 text-lg">{editingService.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}</h4>
              <button onClick={() => setShowServiceForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[80vh] overflow-y-auto">
`;

content = content.replace(formStr, modalStr);

// Close the form
const formEndStr = `                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowServiceForm(false)}>Hủy</Button>
                  <Button type="submit" size="sm">Lưu</Button>
                </div>
              </form>
            </div>
          )}`;
          
const modalEndStr = `                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
                  <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setShowServiceForm(false)}>Hủy</Button>
                  <Button type="submit" className="rounded-xl font-bold bg-teal-600 hover:bg-teal-700">Lưu dịch vụ</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(formEndStr, modalEndStr);

// Add tags field to the form
const tagsField = `
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block">Tag Dịch vụ Cao cấp</label>
                  <Input 
                    placeholder="VD: KHÔNG ĐAU, TRẢ GÓP 0% (cách nhau bằng dấu phẩy)"
                    value={(editingService.tags || []).join(', ')} 
                    onChange={e => setEditingService({...editingService, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Các tag này sẽ hiển thị nổi bật ở bước Chọn Dịch Vụ.</p>
                </div>
`;

content = content.replace(
  `                <div className="flex flex-wrap items-center gap-6 pt-2">`, 
  tagsField + `                <div className="flex flex-wrap items-center gap-6 pt-2">`
);

// DO THE SAME FOR PROVIDER FORM
const provFormStr = `{showProviderForm && editingProvider && (
            <div className="mb-6 p-4 border border-border-subtle rounded-lg bg-bg-base relative">`;
            
const provModalStr = `{showProviderForm && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h4 className="font-bold text-slate-800 text-lg">{editingProvider.id ? 'Sửa bác sĩ' : 'Thêm bác sĩ mới'}</h4>
              <button onClick={() => setShowProviderForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[80vh] overflow-y-auto">`;

content = content.replace(provFormStr, provModalStr);

const provFormEndStr = `                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowProviderForm(false)}>Hủy</Button>
                  <Button type="submit" size="sm">Lưu</Button>
                </div>
              </form>
            </div>
          )}`;
          
const provModalEndStr = `                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
                  <Button type="button" variant="outline" className="rounded-xl font-bold" onClick={() => setShowProviderForm(false)}>Hủy</Button>
                  <Button type="submit" className="rounded-xl font-bold bg-teal-600 hover:bg-teal-700">Lưu hồ sơ</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(provFormEndStr, provModalEndStr);

// Move modals to root of the page instead of inside the Grid
// But it's easier to just leave them where they are since they are fixed inset-0.

fs.writeFileSync('src/pages/admin/ServicesConfig.tsx', content);
