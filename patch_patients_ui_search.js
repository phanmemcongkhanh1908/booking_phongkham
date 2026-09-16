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

// Use effect for searching
const regexSearchEffect = /\\s*const filteredPatients = patients\\.filter[\\s\\S]*?\\);/g;

code = code.replace(regexSearchEffect, `  const filteredPatients = patients;
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchPatients(1, searchTerm, filterType);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterType]);
`);

// Initial fetch is already there?
const regexInitFetch = /useEffect\\(\\(\\) => \\{\\n\\s+fetchPatients\\(\\);\\n\\s+fetchAppointments\\(\\);\\n\\s+\\}, \\[\\]\\);/g;
code = code.replace(regexInitFetch, `useEffect(() => {
    fetchAppointments();
    // fetchPatients is handled by the search effect on mount
  }, []);`);

fs.writeFileSync(file, code);
