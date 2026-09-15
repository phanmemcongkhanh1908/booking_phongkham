const fs = require('fs');
let code = fs.readFileSync('server/api/patients/index.ts', 'utf8');

code = code.replace('const page = parseInt(req.query.page) || 1;', 'const page = parseInt(req.query.page as string) || 1;');
code = code.replace('const limit = parseInt(req.query.limit) || 50;', 'const limit = parseInt(req.query.limit as string) || 50;');

fs.writeFileSync('server/api/patients/index.ts', code);
