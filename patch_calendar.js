import fs from 'fs';
let file = 'src/pages/admin/CalendarView.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `          <DnDCalendar
            localizer={localizer}
            events={events}`;

const newStr = `          <DnDCalendar
            draggableAccessor={() => window.innerWidth > 768}
            localizer={localizer}
            events={events}`;

code = code.replace(targetStr, newStr);

fs.writeFileSync(file, code);
