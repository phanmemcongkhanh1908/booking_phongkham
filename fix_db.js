import fs from 'fs';
const file = 'server/data/store.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (data.settings) {
  let changed = false;
  for (const sId of Object.keys(data.settings)) {
    const s = data.settings[sId];
    // If tenantId matches a user's id but not a valid tenantId
    if (s.tenantId && !s.tenantId.startsWith('tenant-')) {
      const user = Object.values(data.users || {}).find(u => u.id === s.tenantId);
      if (user && user.tenantId) {
        s.tenantId = user.tenantId;
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log("Fixed DB settings tenant IDs");
  }
}
