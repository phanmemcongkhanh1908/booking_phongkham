const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ServicesConfig.tsx', 'utf8');

// 1. Add tags to form state
if (!content.includes('editingService.tags')) {
    content = content.replace("onChange={e => setEditingService({...editingService, isHot: e.target.checked})} className=\"rounded border-border-subtle text-primary focus:ring-teal-600\" />",
    "onChange={e => setEditingService({...editingService, isHot: e.target.checked})} className=\"rounded border-border-subtle text-primary focus:ring-teal-600\" />\n                    <span>Nổi bật (HOT)</span>\n                  </label>\n                </div>\n                <div>\n                  <label className=\"text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 block\">Tag Dịch vụ (Ví dụ: KHÔNG ĐAU, TRẢ GÓP 0%)</label>\n                  <Input \n                    placeholder=\"Nhập các tag cách nhau bằng dấu phẩy (,)\"\n                    value={(editingService.tags || []).join(', ')} \n                    onChange={e => setEditingService({...editingService, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} \n                  />\n                </div>");
    
    // Fix the replacement that might duplicate "Nổi bật" label by searching carefully.
}

