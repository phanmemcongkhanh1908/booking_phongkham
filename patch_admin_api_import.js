import fs from 'fs';
let file = 'server/api/admin/index.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { eq } from "drizzle-orm"')) {
    code = 'import { eq } from "drizzle-orm";\n' + code;
    fs.writeFileSync(file, code);
}
