const fs = require('fs');
const file = 'server/api/admin/index.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    if (announcementBanner !== undefined) {
      await db.insert(settings)
        .values({ id: 'announcementBanner', value: announcementBanner })
        .onConflictDoUpdate({ target: settings.id, set: { value: announcementBanner } });
    }`;

const insert = target + `
    if (idleTimeoutMinutes !== undefined) {
      await db.insert(settings)
        .values({ id: 'idleTimeoutMinutes', value: String(idleTimeoutMinutes) })
        .onConflictDoUpdate({ target: settings.id, set: { value: String(idleTimeoutMinutes) } });
    }`;

code = code.replace(target, insert);
fs.writeFileSync(file, code);
