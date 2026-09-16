import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const toRemove = `  useEffect(() => {
    if (dateRange && viewMode === 'calendar') {
      fetchAppointments(true);
    }
  }, [dateRange, viewMode]);`;

// only remove the first one (which is before dateRange definition)
const idx = code.indexOf(toRemove);
if (idx !== -1) {
  code = code.substring(0, idx) + code.substring(idx + toRemove.length);
}

fs.writeFileSync(file, code);
