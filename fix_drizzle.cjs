const fs = require('fs');
const path = 'drizzle.config.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('user: process.env.SQL_USER || ""', 'user: process.env.SQL_ADMIN_USER || ""');
content = content.replace('password: process.env.SQL_PASSWORD || ""', 'password: process.env.SQL_ADMIN_PASSWORD || ""');
fs.writeFileSync(path, content);
