const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/DateTimeSelection.tsx', 'utf8');
content = content.replace(
  "import { \n  Calendar as CalendarIcon,\n  BellRing,",
  "import { \n  Calendar as CalendarIcon,\n  BellRing,"
);

if (!content.includes('BellRing')) {
    content = content.replace(
      "import { \n  Calendar as CalendarIcon,",
      "import { \n  Calendar as CalendarIcon,\n  BellRing,"
    );
}
fs.writeFileSync('src/pages/public/components/DateTimeSelection.tsx', content);
