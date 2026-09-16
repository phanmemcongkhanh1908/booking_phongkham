import fs from 'fs';
const data = JSON.parse(fs.readFileSync('server/data/store.json', 'utf8'));
const users = data.users || {};
console.log(Object.values(users).map(u => ({ id: u.id, username: u.username, tenantId: u.tenantId, slug: u.slug })));
