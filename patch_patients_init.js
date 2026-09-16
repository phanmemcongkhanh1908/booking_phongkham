import fs from 'fs';
let file = 'src/pages/admin/Patients.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "fetchPatients();\\n    fetchAppointments();",
  "fetchAppointments(); // fetchPatients handled by search effect"
);
code = code.replace(
  "fetchPatients();\n    fetchAppointments();",
  "fetchAppointments(); // fetchPatients handled by search effect"
);
fs.writeFileSync(file, code);
