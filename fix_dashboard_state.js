import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = "const [activeTab, setActiveTab] = useState<'appointments' | 'patients' | 'settings' | 'services' | 'analytics' | 'users'>(defaultTab as any);";

if (!code.includes("const [page, setPage] = useState(1);")) {
  code = code.replace(anchor, anchor + `
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
`);
}

fs.writeFileSync(file, code);
