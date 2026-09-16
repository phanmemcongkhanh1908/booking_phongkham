import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const regexUseEffect = /\\s*useEffect\\(\\(\\) => \\{\\n\\s*if \\(dateRange && viewMode === 'calendar'\\) \\{\\n\\s*fetchAppointments\\(true\\);\\n\\s*\\}\\n\\s*\\}, \\[dateRange, viewMode\\]\\);\\n/g;

code = code.replace(regexUseEffect, '');

// insert it right after dateRange declaration
code = code.replace(
  "const [dateRange, setDateRange] = useState<{start: Date, end: Date} | null>(null);",
  `const [dateRange, setDateRange] = useState<{start: Date, end: Date} | null>(null);

  useEffect(() => {
    if (dateRange && viewMode === 'calendar') {
      fetchAppointments(true);
    }
  }, [dateRange, viewMode]);`
);

fs.writeFileSync(file, code);
