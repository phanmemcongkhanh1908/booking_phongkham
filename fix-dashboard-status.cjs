const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

// The replacement for status was done in previous script but wait, I see {apt.status} is still literally there in Dashboard.tsx
// because the previous script used a regex that didn't match.

const statusStr = `                            {apt.status === 'CANCEL_CLINIC' ? 'Đã Hủy' : apt.status === 'CANCEL_PATIENT' ? 'Khách Hủy' : apt.status === 'CONFIRMED' ? 'Đã Xác Nhận' : apt.status === 'COMPLETED' ? 'Hoàn Thành' : apt.status === 'CHECKED_IN' ? 'Đã Check-in' : apt.status === 'IN_SERVICE' ? 'Đang Khám' : apt.status === 'REQUESTED' || apt.status === 'PENDING' ? 'Chờ Xác Nhận' : apt.status}`;

content = content.replace(
  /<span className=\{\`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium \$\{getStatusColor\(apt\.status\)\}\`\}>\s*\{apt\.status\}\s*<\/span>/,
  `<span className={\`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border \${getStatusColor(apt.status).replace('bg-', 'bg-opacity-10 border-').replace('text-', 'text-')}\`}>\n                            ${statusStr}\n                          </span>`
);

// We need a better `getStatusColor` modifier.
// Let's just create a better getStatusName function and update getStatusColor.
