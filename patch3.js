import fs from 'fs';
const file = 'src/pages/admin/ServicesConfig.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { toast } from 'sonner';",
  "import { toast } from 'sonner';\nimport { usePermissions } from '../../hooks/usePermissions';"
);

fs.writeFileSync(file, code);
