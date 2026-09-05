const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

// Update button texts to match the updated status text for consistency
content = content.replace(/>Xác nhận<\/button>/g, '>Xác Nhận</button>');
content = content.replace(/>Hủy<\/button>/g, '>Hủy Lịch</button>');
content = content.replace(/>Phục vụ<\/button>/g, '>Đang Khám</button>');
content = content.replace(/>Hoàn thành<\/button>/g, '>Hoàn Thành</button>');

// Enhance button styles
const btnStyle = (bg, text, hover) => `className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all ${bg} ${text} ${hover} border-transparent hover:border-current/10"`;

content = content.replace(/className="text-xs px-2\.5 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold transition-colors"/g, btnStyle('bg-teal-50', 'text-teal-700', 'hover:bg-teal-100'));
content = content.replace(/className="text-xs px-2\.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors"/g, btnStyle('bg-indigo-50', 'text-indigo-700', 'hover:bg-indigo-100'));
content = content.replace(/className="text-xs px-2\.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"/g, btnStyle('bg-red-50', 'text-red-700', 'hover:bg-red-100'));
content = content.replace(/className="text-xs px-2\.5 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold transition-colors"/g, btnStyle('bg-purple-50', 'text-purple-700', 'hover:bg-purple-100'));
content = content.replace(/className="text-xs px-2\.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors"/g, btnStyle('bg-green-50', 'text-green-700', 'hover:bg-green-100'));

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
