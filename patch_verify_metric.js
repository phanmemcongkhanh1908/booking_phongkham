import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    // Check Firebase Token if provided
    if (firebaseToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);`;

const replace = `    // Check Firebase Token if provided
    if (firebaseToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        
        // --- START QUOTA TRACKER ---
        try {
          const { system_metrics } = await import('../../db/schema.js');
          const date = new Date();
          const monthKey = \`otp_sent_\${date.getFullYear()}_\${date.getMonth() + 1}\`;
          const metrics = await db.select().from(system_metrics).where(eq(system_metrics.id, monthKey)).limit(1);
          if (metrics.length > 0) {
            await db.update(system_metrics).set({ value: (Number(metrics[0].value) || 0) + 1 }).where(eq(system_metrics.id, monthKey));
          } else {
            await db.insert(system_metrics).values({ id: monthKey, value: 1, updatedAt: new Date().toISOString() });
          }
        } catch(e) {
          console.error("Lỗi đếm quota OTP", e);
        }
        // --- END QUOTA TRACKER ---
        `;

code = code.replace(target, replace);
fs.writeFileSync(file, code);
