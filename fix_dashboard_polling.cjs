const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const fetchFix = `
      // Load current month's appointments to cover calendar view and list view
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = new Date();
      end.setMonth(end.getMonth() + 2); // get up to next month
      
      const res = await api.get('/appointments', {
        params: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        }
      });
`;

content = content.replace(
  "const res = await api.get('/appointments');",
  fetchFix
);

// We need to import startOfWeek
if (!content.includes('startOfWeek')) {
  content = content.replace(
    "import { format, differenceInMinutes } from 'date-fns';",
    "import { format, differenceInMinutes, startOfWeek } from 'date-fns';"
  );
}

fs.writeFileSync(path, content);
