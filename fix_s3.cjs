const fs = require('fs');
const pathServer = 'server/api/public/index.ts';
let contentServer = fs.readFileSync(pathServer, 'utf8');

const s3Fix = `
publicRouter.post("/appointments/:id/notify", async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { email, telegramId, phone } = req.body;

    if (!phone) {
      throw new BadRequestError("Vui lòng cung cấp số điện thoại để xác thực");
    }

    const aptList = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (aptList.length === 0) throw new NotFoundError("Không tìm thấy lịch hẹn");
    const apt = aptList[0];

    const pList = await db.select().from(patients).where(eq(patients.id, apt.patientId)).limit(1);
    if (pList.length === 0) throw new NotFoundError("Không tìm thấy thông tin bệnh nhân");
    const patient = pList[0];
    
    // Verify phone number to prevent IDOR
    if (patient.phone !== phone) {
      throw new ForbiddenError("Xác thực số điện thoại không hợp lệ");
    }
`;

contentServer = contentServer.replace(
  /publicRouter\.post\("\/appointments\/:id\/notify", async \(req, res, next\) => \{\n\s*try \{\n\s*const appointmentId = req\.params\.id;\n\s*const \{ email, telegramId \} = req\.body;\n\n\s*const aptList = await db\.select\(\)\.from\(appointments\)\.where\(eq\(appointments\.id, appointmentId\)\)\.limit\(1\);\n\s*if \(aptList\.length === 0\) throw new NotFoundError\("Không tìm thấy lịch hẹn"\);\n\s*const apt = aptList\[0\];\n\n\s*const pList = await db\.select\(\)\.from\(patients\)\.where\(eq\(patients\.id, apt\.patientId\)\)\.limit\(1\);\n\s*if \(pList\.length === 0\) throw new NotFoundError\("Không tìm thấy thông tin bệnh nhân"\);\n\s*const patient = pList\[0\];/m,
  s3Fix
);

fs.writeFileSync(pathServer, contentServer);

const pathClient = 'src/pages/public/components/SuccessView.tsx';
let contentClient = fs.readFileSync(pathClient, 'utf8');

contentClient = contentClient.replace(
  'email: emailInput.trim(),',
  'email: emailInput.trim(),\n        phone: patientPhone,'
);

fs.writeFileSync(pathClient, contentClient);
