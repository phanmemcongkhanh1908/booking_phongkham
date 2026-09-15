import fs from 'fs';
let file = 'server/api/auth/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "tenantId: user.tenantId,",
  "tenantId: user.tenantId,\n          uiMode: user.uiMode,\n          slug: user.slug,"
);

fs.writeFileSync(file, code);
