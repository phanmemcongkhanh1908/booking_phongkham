const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/CalendarView.tsx', 'utf8');

const buttonStyles = {
  CONFIRMED: 'px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold transition-colors',
  CHECKED_IN: 'px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors',
  CANCEL_CLINIC: 'px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors',
  IN_SERVICE: 'px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold transition-colors',
  COMPLETED: 'px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors',
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

fs.writeFileSync('src/pages/admin/CalendarView.tsx', content);
