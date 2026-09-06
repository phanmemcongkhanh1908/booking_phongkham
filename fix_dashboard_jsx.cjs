const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the bad replacement back to APPOINTMENT_STATUSES
content = content.replace(
  /\['PENDING', 'REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW', 'CANCEL_PATIENT', 'CANCEL_CLINIC', 'RESCHEDULED'\]/g,
  "APPOINTMENT_STATUSES"
);

// Replace the bad replacement back to LABEL_OVERRIDES
// But wait, there might be {} that I shouldn't replace.
// Let's look at the exact line 451:
// apt.status as keyof typeof APPOINTMENT_STATUSES]]?.label || apt.status}
// If I replaced LABEL_OVERRIDES with {}, I'll need to find where {} was used instead of LABEL_OVERRIDES in this specific context.
// Let's just run a regex to find `{}[apt.status]` and replace it.
content = content.replace(/\{\}\[apt\.status\]/g, "LABEL_OVERRIDES[apt.status]");

// Add the missing import
if (!content.includes('import { APPOINTMENT_STATUSES')) {
  content = content.replace(
    "import { format, differenceInMinutes, startOfWeek } from 'date-fns';",
    "import { format, differenceInMinutes, startOfWeek } from 'date-fns';\nimport { APPOINTMENT_STATUSES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';"
  );
}

fs.writeFileSync(path, content);
