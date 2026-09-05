import fs from 'fs';
let content = fs.readFileSync('server/api/patients/index.ts', 'utf8');

const importStr = `import { sendPatientDocument } from "../../core/telegram.js";\n`;
if (!content.includes('sendPatientDocument')) {
  content = content.replace('import { requireAuth }', importStr + 'import { requireAuth }');
}

const endpoint = `
patientsRouter.post("/:id/send-document", requireAuth, async (req, res, next) => {
  try {
    const pt = await db.select().from(patients).where(eq(patients.id, req.params.id)).limit(1);
    if (pt.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Patient not found" } });
    }
    
    // Allow updating telegramId on the fly
    const telegramId = req.body.telegramId || pt[0].telegramId;
    
    if (req.body.telegramId && req.body.telegramId !== pt[0].telegramId) {
      await db.update(patients).set({ telegramId: req.body.telegramId }).where(eq(patients.id, req.params.id));
    }

    if (!telegramId) {
      return res.status(400).json({ success: false, error: { message: "Bệnh nhân chưa có thông tin Telegram" } });
    }

    const { base64Data, filename, caption } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: { message: "Missing base64Data" } });
    }

    const base64Content = base64Data.split(';base64,').pop();
    const buffer = Buffer.from(base64Content, 'base64');

    const result = await sendPatientDocument(telegramId, buffer, filename || 'document.png', caption);
    if (result) {
      res.json({ success: true, message: "Gửi tài liệu qua Telegram thành công" });
    } else {
      res.status(500).json({ success: false, error: { message: "Không thể gửi tin nhắn qua Telegram, vui lòng thử lại sau" } });
    }
  } catch (error) {
    next(error);
  }
});
`;

if (!content.includes('/send-document')) {
  content = content.replace('export default patientsRouter;', endpoint + '\nexport default patientsRouter;');
}

fs.writeFileSync('server/api/patients/index.ts', content);
