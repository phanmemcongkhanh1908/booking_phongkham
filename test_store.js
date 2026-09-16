import fs from 'fs';
const data = JSON.parse(fs.readFileSync('server/data/store.json', 'utf8'));
const settings = data.settings || {};
console.log(Object.values(settings).map(s => ({ id: s.id, tenantId: s.tenantId, key: s.key })));
