const fs = require('fs');
const file = 'server/api/admin/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig, bookingFormConfig, announcementBanner } = req.body;',
  'const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig, bookingFormConfig, announcementBanner, idleTimeoutMinutes } = req.body;'
);

const insertBlock = `    if (announcementBanner !== undefined) {
      await db.insert(settings)
        .values({ id: 'announcementBanner', value: JSON.stringify(announcementBanner) })
        .onConflictDoUpdate({ target: settings.id, set: { value: JSON.stringify(announcementBanner) } });
    }`;

const replaceBlock = insertBlock + `\n    if (idleTimeoutMinutes !== undefined) {
      await db.insert(settings)
        .values({ id: 'idleTimeoutMinutes', value: idleTimeoutMinutes })
        .onConflictDoUpdate({ target: settings.id, set: { value: idleTimeoutMinutes } });
    }`;

code = code.replace(insertBlock, replaceBlock);

fs.writeFileSync(file, code);
