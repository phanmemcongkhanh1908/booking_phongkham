import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'publicRouter.post("/patients/send-otp", async (req, res, next) => {',
  'publicRouter.post("/patients/send-otp", patientVerifyLimiter, async (req, res, next) => {'
);
fs.writeFileSync(file, code);
