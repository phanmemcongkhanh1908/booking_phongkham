import fs from 'fs';
let file = 'src/pages/admin/Patients.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetFetch = `  const fetchPatients = async (fetchPage = page) => {
    try {
      const res = await api.get('/patients', { params: { page: fetchPage, limit: 50 } });`;

const newFetch = `  const fetchPatients = async (fetchPage = page, currentSearch = searchTerm, currentFilter = filterType) => {
    try {
      setLoading(true);
      const res = await api.get('/patients', { params: { page: fetchPage, limit: 50, search: currentSearch, filter: currentFilter } });`;
      
code = code.replace(targetFetch, newFetch);

const startIdx = code.indexOf("const filteredPatients = patients.filter(p => {");
const endIdx = code.indexOf("return true;", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
   const blockEnd = code.indexOf("});", endIdx) + 3;
   
   const replacement = `const filteredPatients = patients;
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchPatients(1, searchTerm, filterType);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterType]);`;

   code = code.substring(0, startIdx) + replacement + code.substring(blockEnd);
}

const regexInitFetch = /useEffect\(\(\) => \{\n\s+fetchPatients\(\);\n\s+fetchAppointments\(\);\n\s+\}, \[\]\);/g;
code = code.replace(regexInitFetch, `useEffect(() => {
    fetchAppointments();
  }, []);`);

fs.writeFileSync(file, code);
