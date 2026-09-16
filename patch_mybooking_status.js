import fs from 'fs';
let file = 'src/pages/public/MyBooking.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { APPOINTMENT_STATUSES } from '../../constants/appointmentStatus';",
  "import { APPOINTMENT_STATUSES, STATUS_ALIASES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';"
);

const statusTarget = "const statusConfig = APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES] || APPOINTMENT_STATUSES.PENDING;";
const statusReplace = `const mappedStatus = STATUS_ALIASES[apt.status] || apt.status;
              const statusConfig = APPOINTMENT_STATUSES[mappedStatus as keyof typeof APPOINTMENT_STATUSES] || APPOINTMENT_STATUSES.PENDING;
              const displayLabel = LABEL_OVERRIDES[apt.status] || statusConfig.label;`;

code = code.replace(statusTarget, statusReplace);

code = code.replace("{statusConfig.label}", "{displayLabel}");

fs.writeFileSync(file, code);
