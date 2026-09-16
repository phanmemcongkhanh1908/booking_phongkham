import fs from 'fs';
let file = 'server/api/users/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "tenantId: newUser[0].id,",
  "tenantId: newTenantId || undefined,"
);

fs.writeFileSync(file, code);
