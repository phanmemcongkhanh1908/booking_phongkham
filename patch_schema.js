import fs from 'fs';
let file = 'server/db/schema.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('system_metrics')) {
  code = code.replace(
    'export const settings: any = createTable("settings");',
    'export const settings: any = createTable("settings");\nexport const system_metrics: any = createTable("system_metrics");'
  );
  fs.writeFileSync(file, code);
}
