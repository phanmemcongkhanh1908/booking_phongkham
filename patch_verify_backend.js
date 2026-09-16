import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the OTP store and send-otp mock completely.
const targetToRemove = `// Temporary in-memory OTP store
const otpStore = new Map<string, { code: string, expires: number }>();

publicRouter.post("/patients/send-otp", patientVerifyLimiter, async (req, res, next) => {
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
});`;

code = code.replace(targetToRemove, '');

const verifyTarget = `publicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {
  try {
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

const verifyReplace = `import { adminAuth } from "../../lib/firebase-admin.js";

publicRouter.post("/patients/verify", patientVerifyLimiter, async (req, res, next) => {
  try {
    const { phone, fullName, firebaseToken } = req.body;
    if (!phone) return res.json({ success: false, match: false });

    let isOtpVerified = false;

    // Check Firebase Token if provided
    if (firebaseToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        // Ensure the phone number matches
        const tokenPhone = decodedToken.phone_number; // Format: +84...
        const rawPhone = String(phone).trim().replace(/\\D/g, "");
        const rawTokenPhone = (tokenPhone || "").replace(/\\D/g, "");
        
        // Match the last 9 digits (since 84912345678 and 0912345678 both end in 912345678)
        if (rawTokenPhone.length >= 9 && rawPhone.length >= 9 && rawTokenPhone.slice(-9) === rawPhone.slice(-9)) {
          isOtpVerified = true;
        } else {
          return res.json({ success: false, error: "Số điện thoại xác thực không khớp" });
        }
      } catch (err) {
         console.error("Firebase Auth Error", err);
         return res.json({ success: false, error: "Mã xác thực Firebase không hợp lệ hoặc đã hết hạn" });
      }
    } else if (!fullName) {
       return res.json({ success: false, match: false });
    }

    const rawPhone = String(phone).trim();`;

code = code.replace(verifyTarget, verifyReplace);

// Update matching logic
const matchTarget = `        // If OTP verified, we just match by phone directly
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

const matchReplace = `        // If OTP verified, we just match by phone directly
        if (isOtpVerified) {
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
