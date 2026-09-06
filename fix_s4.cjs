const fs = require('fs');
const path = 'server/api/notifications/index.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'notificationRouter.post("/subscribe", async (req, res, next) => {',
  'notificationRouter.post("/subscribe", requireAuth, async (req, res, next) => {'
);

fs.writeFileSync(path, content);
