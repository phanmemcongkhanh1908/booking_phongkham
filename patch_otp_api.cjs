const fs = require('fs');
let code = fs.readFileSync('server/api/public/index.ts', 'utf8');

// Replace the existing verify endpoint
const targetVerify = `// Endpoint xác thực khách hàng cũ bằng SĐT + Họ tên (Fuzzy Match)
publicRouter.post("/patients/verify", async (req, res, next) => {
  try {
    const { phone, fullName } = req.body;
    if (!phone || !fullName) return res.json({ success: false, match: false });

    const rawPhone = String(phone).trim();
    const cleaned = rawPhone.replace(/\\D/g, "");

    const variants = new Set<string>();
    variants.add(cleaned);
    if (cleaned.startsWith("84")) {
      variants.add("0" + cleaned.slice(2)); variants.add(cleaned.slice(2));
    } else if (cleaned.startsWith("0")) {
      variants.add("84" + cleaned.slice(1)); variants.add(cleaned.slice(1));
    } else {
      variants.add("0" + cleaned); variants.add("84" + cleaned);
    }

    const pts = await db.select().from(patients);
    let matchedPatient = null;
    for (const p of pts) {
      if (!p.phone) continue;
      if (variants.has(String(p.phone).replace(/\\D/g, ""))) {
        const pName = normalizeName(p.fullName);
        const searchName = normalizeName(fullName);
        if (pName && searchName && (pName === searchName)) { // STRICT MATCH
          matchedPatient = p;
          break;
        }
      }
    }

    if (!matchedPatient) {
      return res.json({ success: false, match: false });
    }

    return res.json({ 
      success: true, 
      match: true, 
      data: {
        fullName: matchedPatient.fullName,
        email: matchedPatient.email,
        notes: matchedPatient.notes
      }
    });
  } catch (error) { next(error); }
});`;

const replaceVerify = `// Endpoint gửi OTP ảo
publicRouter.post("/patients/send-otp", async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: { message: "Thiếu số điện thoại" } });
    
    // Simulate sending OTP (In a real app, integrate SMS/Zalo API here)
    // For demo purposes, we'll use a static OTP: 123456
    return res.json({ success: true, message: "Mã OTP đã được gửi", devOtp: "123456" });
  } catch (error) { next(error); }
});

// Endpoint xác thực khách hàng cũ bằng SĐT + OTP
publicRouter.post("/patients/verify", async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.json({ success: false, match: false });

    // In a real app, verify OTP against DB or Redis cache.
    // For demo, we check against our static OTP
    if (otp !== '123456') {
      return res.json({ success: false, match: false, error: "Mã OTP không chính xác" });
    }

    const rawPhone = String(phone).trim();
    const cleaned = rawPhone.replace(/\\D/g, "");

    const variants = new Set<string>();
    variants.add(cleaned);
    if (cleaned.startsWith("84")) {
      variants.add("0" + cleaned.slice(2)); variants.add(cleaned.slice(2));
    } else if (cleaned.startsWith("0")) {
      variants.add("84" + cleaned.slice(1)); variants.add(cleaned.slice(1));
    } else {
      variants.add("0" + cleaned); variants.add("84" + cleaned);
    }

    const pts = await db.select().from(patients);
    let matchedPatient = null;
    for (const p of pts) {
      if (!p.phone) continue;
      if (variants.has(String(p.phone).replace(/\\D/g, ""))) {
        matchedPatient = p;
        break; // Match first patient with this phone
      }
    }

    if (!matchedPatient) {
      return res.json({ success: false, match: false });
    }

    return res.json({ 
      success: true, 
      match: true, 
      data: {
        fullName: matchedPatient.fullName,
        email: matchedPatient.email,
        notes: matchedPatient.notes
      }
    });
  } catch (error) { next(error); }
});`;

code = code.replace(targetVerify, replaceVerify);
fs.writeFileSync('server/api/public/index.ts', code);
console.log('OTP verification API added.');
