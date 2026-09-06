const fs = require('fs');
const path = 'server/api/admin/index.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { requireAuth, requirePermission }')) {
  content = content.replace(
    'import { requireAuth } from "../../core/middleware.js";',
    'import { requireAuth, requirePermission } from "../../core/middleware.js";'
  );
}

// Secure backup
content = content.replace(
  'adminRouter.get("/backup", requireAuth, async',
  'adminRouter.get("/backup", requireAuth, requirePermission("*"), async'
);

// Secure wipe
content = content.replace(
  'adminRouter.post("/wipe", requireAuth, async',
  'adminRouter.post("/wipe", requireAuth, requirePermission("*"), async'
);

// Secure settings save
content = content.replace(
  'adminRouter.post("/settings", requireAuth, async',
  'adminRouter.post("/settings", requireAuth, requirePermission("*"), async'
);

// S2: settings should not return credentials in plain text.
// We can omit smtpPassword and telegramToken from the GET response, or mask them.
const getSettingsFix = `
adminRouter.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingsObj: any = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    
    // Mask sensitive data
    if (settingsObj.smtpPassword) settingsObj.smtpPassword = "••••••••";
    if (settingsObj.telegramToken) settingsObj.telegramToken = "••••••••";
    
    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
});
`;

content = content.replace(
  /adminRouter\.get\("\/settings", requireAuth, async \(req, res, next\) => \{[\s\S]*?\}\);\n/m,
  getSettingsFix
);

fs.writeFileSync(path, content);
