const fs = require('fs');

// 1. Dashboard.tsx
let dbFile = 'src/pages/admin/Dashboard.tsx';
let dbCode = fs.readFileSync(dbFile, 'utf8');
if (!dbCode.includes('CheckCircle2')) {
  dbCode = dbCode.replace('LogOut,', 'LogOut, CheckCircle2, AlertTriangle,');
}
if (!dbCode.includes('useGoogleAuthStore')) {
  dbCode = `import { useGoogleAuthStore } from '../../store/googleAuthStore';\n` + dbCode;
  dbCode = dbCode.replace(
    'const isSimpleMode = user?.uiMode === \'simple\';',
    'const isSimpleMode = user?.uiMode === \'simple\';\n  const { isConnected, connect: connectGoogleStore } = useGoogleAuthStore();'
  );
}
dbCode = dbCode.replace('ServerSpeechEngine.init();', 'ServerSpeechEngine.resume();');
fs.writeFileSync(dbFile, dbCode);

// 2. Patients.tsx
let ptFile = 'src/pages/admin/Patients.tsx';
let ptCode = fs.readFileSync(ptFile, 'utf8');
if (!ptCode.includes('Loader2')) {
  ptCode = ptCode.replace('CalendarPlus,', 'CalendarPlus, Loader2,');
}
ptCode = ptCode.replace('fetchPatientData(selectedPatient.id);', '');
fs.writeFileSync(ptFile, ptCode);

// 3. Settings.tsx (setUserAccounts)
let setFile = 'src/pages/admin/Settings.tsx';
let setCode = fs.readFileSync(setFile, 'utf8');
setCode = setCode.replace('setUserAccounts(res.data.data);', '');
fs.writeFileSync(setFile, setCode);

// 4. server/api/admin/index.ts (users)
let admFile = 'server/api/admin/index.ts';
let admCode = fs.readFileSync(admFile, 'utf8');
if (!admCode.includes('export const users: any')) {
  admCode = admCode.replace(
    'import { services, providers, settings, appointments, patients } from "../../db/schema.js";',
    'import { services, providers, settings, appointments, patients, users } from "../../db/schema.js";'
  );
}
fs.writeFileSync(admFile, admCode);
