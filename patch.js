import fs from 'fs';
const file = 'src/pages/admin/ServicesConfig.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  "import { useAuthStore } from '../../store/auth';",
  "import { useAuthStore } from '../../store/auth';\nimport { usePermissions } from '../../hooks/usePermissions';"
);
code = code.replace(
  "const [loading, setLoading] = useState(true);",
  "const [loading, setLoading] = useState(true);\n  const { hasPermission } = usePermissions();"
);

fs.writeFileSync(file, code);
