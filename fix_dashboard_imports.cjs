const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { format, differenceInMinutes } from 'date-fns';",
  "import { format, differenceInMinutes, startOfWeek } from 'date-fns';"
);

// Also fix the APPOINTMENT_STATUSES error
content = content.replace(
  /APPOINTMENT_STATUSES/g,
  "['PENDING', 'REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC', 'RESCHEDULED']"
);

// Also fix the LABEL_OVERRIDES error
content = content.replace(
  /LABEL_OVERRIDES/g,
  "{}"
);

// Also fix the MouseEventHandler issue for fetchAppointments
content = content.replace(
  '<button onClick={fetchAppointments} className="text-sm font-medium text-primary hover:underline hidden sm:block">Làm mới</button>',
  '<button onClick={() => fetchAppointments()} className="text-sm font-medium text-primary hover:underline hidden sm:block">Làm mới</button>'
);

fs.writeFileSync(path, content);
