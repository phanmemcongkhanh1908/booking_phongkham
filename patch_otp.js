import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

const sendOtpRoute = `
// Temporary in-memory OTP store
const otpStore = new Map<string, { code: string, expires: number }>();

publicRouter.post("/patients/send-otp", async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: "Missing phone" });

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in memory for 5 minutes
    otpStore.set(phone, { code, expires: Date.now() + 5 * 60000 });

    // In a real app, this would call Zalo ZNS or SMS gateway.
    // For our 100% free deployment, we just return it in the response (Dev mode).
    res.json({ success: true, devOtp: code });
  } catch (err) {
    next(err);
  }
});
`;

code = code.replace(
  'publicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {',
  sendOtpRoute + '\npublicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {'
);

const verifyTarget = `  try {
    const { phone, fullName } = req.body;
    if (!phone || !fullName) return res.json({ success: false, match: false });

    const rawPhone = String(phone).trim();`;

const verifyReplace = `  try {
    const { phone, fullName, otp } = req.body;
    if (!phone) return res.json({ success: false, match: false });

    // Check OTP if provided (Frontend now uses OTP)
    if (otp) {
      const stored = otpStore.get(phone);
      if (!stored || stored.code !== String(otp).trim() || stored.expires < Date.now()) {
        return res.json({ success: false, error: "Mã OTP không chính xác hoặc đã hết hạn" });
      }
      otpStore.delete(phone); // Burn after reading
    } else if (!fullName) {
       // If neither OTP nor fullName provided, fail
       return res.json({ success: false, match: false });
    }

    const rawPhone = String(phone).trim();`;

code = code.replace(verifyTarget, verifyReplace);

// Also modify the matching logic because currently it matches by `fullName` if `fullName` is passed.
// But if only `otp` is passed, `fullName` is undefined, so we shouldn't strictly match `fullName`.

const matchTarget = `        const pName = normalizeName(p.fullName);
        const searchName = normalizeName(fullName);
        if (pName && searchName && (pName === searchName)) { // STRICT MATCH
          matchedPatient = p;
          break;
        }`;

const matchReplace = `        // If OTP verified, we just match by phone directly
        if (otp) {
          matchedPatient = p;
          break;
        } else {
          const pName = normalizeName(p.fullName);
          const searchName = normalizeName(fullName || "");
          if (pName && searchName && (pName === searchName)) { // STRICT MATCH
            matchedPatient = p;
            break;
          }
        }`;

code = code.replace(matchTarget, matchReplace);

fs.writeFileSync(file, code);
