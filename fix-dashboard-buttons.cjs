const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

const buttonStyles = {
  CONFIRMED: 'px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold transition-colors',
  CHECKED_IN: 'px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors',
  CANCEL_CLINIC: 'px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors',
  IN_SERVICE: 'px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold transition-colors',
  COMPLETED: 'px-2.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors',
};

content = content.replace(
  /className="text-xs font-medium text-primary hover:underline"/g,
  `className="text-xs ${buttonStyles.CONFIRMED}"`
);
content = content.replace(
  /className="text-xs font-medium text-indigo-600 hover:underline"/g,
  `className="text-xs ${buttonStyles.CHECKED_IN}"`
);
content = content.replace(
  /className="text-xs font-medium text-status-cancelled hover:underline"/g,
  `className="text-xs ${buttonStyles.CANCEL_CLINIC}"`
);
content = content.replace(
  /className="text-xs font-medium text-purple-600 hover:underline"/g,
  `className="text-xs ${buttonStyles.IN_SERVICE}"`
);
content = content.replace(
  /className="text-xs font-medium text-green-600 hover:underline"/g,
  `className="text-xs ${buttonStyles.COMPLETED}"`
);

// Also fix the status rendering
content = content.replace(
  /\{apt\.status === 'CANCEL_CLINIC' \? 'Hủy' : apt\.status === 'CANCEL_PATIENT' \? 'Khách hủy' : apt\.status === 'CONFIRMED' \? 'Đã xác nhận' : apt\.status === 'COMPLETED' \? 'Hoàn thành' : apt\.status === 'CHECKED_IN' \? 'Đã Check-in' : apt\.status === 'REQUESTED' \|\| apt\.status === 'PENDING' \? 'Chờ xác nhận' : apt\.status\}/g,
  `{apt.status === 'CANCEL_CLINIC' ? 'Đã Hủy' : apt.status === 'CANCEL_PATIENT' ? 'Khách Hủy' : apt.status === 'CONFIRMED' ? 'Đã Xác Nhận' : apt.status === 'COMPLETED' ? 'Hoàn Thành' : apt.status === 'CHECKED_IN' ? 'Đã Check-in' : apt.status === 'IN_SERVICE' ? 'Đang Khám' : apt.status === 'REQUESTED' || apt.status === 'PENDING' ? 'Chờ Xác Nhận' : apt.status}`
);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
