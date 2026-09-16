import fs from 'fs';
let file = 'server/api/admin/index.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `export const adminRouter = express.Router();`;
const replace = `export const adminRouter = express.Router();

adminRouter.get("/system/metrics", async (req, res, next) => {
  try {
    const { system_metrics } = await import('../../db/schema.js');
    const { db } = await import('../../db/index.js');
    
    const date = new Date();
    const monthKey = \`otp_sent_\${date.getFullYear()}_\${date.getMonth() + 1}\`;
    const metrics = await db.select().from(system_metrics).where(eq(system_metrics.id, monthKey)).limit(1);
    
    const currentMonthOtpUsed = metrics.length > 0 ? (Number(metrics[0].value) || 0) : 0;
    const currentMonthOtpLimit = 10000;
    
    res.json({
      success: true,
      data: {
        otp: {
          used: currentMonthOtpUsed,
          limit: currentMonthOtpLimit,
          remaining: Math.max(0, currentMonthOtpLimit - currentMonthOtpUsed)
        }
      }
    });
  } catch(e) {
    next(e);
  }
});`;

code = code.replace(target, replace);
fs.writeFileSync(file, code);
