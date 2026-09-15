const fs = require('fs');
let code = fs.readFileSync('server/api/patients/index.ts', 'utf8');

const targetStr = `patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const allPatients = await db
      .select()
      .from(patients)
      .orderBy(desc(patients.updatedAt));
    res.json({ success: true, data: allPatients });
  } catch (error) {
    next(error);
  }
});`;

const replaceStr = `patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const allPatients = await db
      .select()
      .from(patients)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    // Drizzle doesn't have a simple count query for sqlite without specific functions, 
    // but we can return data and a hasMore flag based on if we got exactly 'limit' rows
    res.json({ 
      success: true, 
      data: allPatients,
      pagination: {
        page,
        limit,
        hasMore: allPatients.length === limit
      }
    });
  } catch (error) {
    next(error);
  }
});`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server/api/patients/index.ts', code);
console.log('Pagination API updated.');
