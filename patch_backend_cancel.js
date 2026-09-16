import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    const pt = await db.select().from(patients).where(eq(patients.id, apts[0].patientId)).limit(1);
    if (pt.length === 0 || pt[0].phone !== phone) {
      return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với hồ sơ đặt lịch" } });
    }`;

const replace = `    const pt = await db.select().from(patients).where(eq(patients.id, apts[0].patientId)).limit(1);
    const rawPhone = String(phone).replace(/\\D/g, "");
    const ptPhone = (pt.length > 0 && pt[0].phone) ? String(pt[0].phone).replace(/\\D/g, "") : "";
    
    // So sánh linh hoạt hơn với 9 số cuối
    if (pt.length === 0 || !ptPhone || !rawPhone || ptPhone.slice(-9) !== rawPhone.slice(-9)) {
      return res.status(403).json({ success: false, error: { message: "Số điện thoại không khớp với hồ sơ đặt lịch" } });
    }`;

code = code.replace(target, replace);
fs.writeFileSync(file, code);
