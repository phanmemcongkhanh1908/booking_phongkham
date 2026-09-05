const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/CalendarView.tsx', 'utf8');

// Do the same for CalendarView.tsx
const btnBlockRegex = /<div className="mt-2 flex gap-1 justify-end border-t border-border-subtle pt-2">([\s\S]*?)<\/div>/;
const match = content.match(btnBlockRegex);

if (match) {
  let inner = match[1];
  
  // Enhance button styles
  const btnStyle = (bg, text, hover) => `className="text-[10px] px-2 py-1 rounded shadow-sm font-bold border transition-all ${bg} ${text} ${hover} border-transparent hover:border-current/10"`;
  
  inner = inner.replace(/className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold transition-colors"/g, btnStyle('bg-teal-50', 'text-teal-700', 'hover:bg-teal-100'));
  inner = inner.replace(/className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors"/g, btnStyle('bg-indigo-50', 'text-indigo-700', 'hover:bg-indigo-100'));
  inner = inner.replace(/className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"/g, btnStyle('bg-red-50', 'text-red-700', 'hover:bg-red-100'));
  inner = inner.replace(/className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold transition-colors"/g, btnStyle('bg-purple-50', 'text-purple-700', 'hover:bg-purple-100'));
  inner = inner.replace(/className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors"/g, btnStyle('bg-green-50', 'text-green-700', 'hover:bg-green-100'));

  inner = inner.replace(/>Xác nhận<\/button>/g, '>Xác Nhận</button>');
  inner = inner.replace(/>Hủy<\/button>/g, '>Hủy Lịch</button>');
  inner = inner.replace(/>Phục vụ<\/button>/g, '>Đang Khám</button>');
  inner = inner.replace(/>Hoàn thành<\/button>/g, '>Hoàn Thành</button>');

  content = content.replace(
    match[0], 
    `<div className="mt-2 flex flex-wrap gap-1.5 justify-end border-t border-border-subtle pt-2">\n${inner}\n</div>`
  );
  
  fs.writeFileSync('src/pages/admin/CalendarView.tsx', content);
}
