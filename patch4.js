import fs from 'fs';
const file = 'src/pages/admin/ServicesConfig.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import toast from 'react-hot-toast';",
  "import toast from 'react-hot-toast';\nimport { usePermissions } from '../../hooks/usePermissions';"
);

fs.writeFileSync(file, code);
