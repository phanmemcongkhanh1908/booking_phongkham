import fs from 'fs';
let file = 'server/api/patients/index.ts';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `    const allPatients = await db
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
    });`;

const newStr = `    const allPatients = await db
      .select()
      .from(patients)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    const countQuery = await db.select({ id: patients.id }).from(patients);
    const total = countQuery.length;

    res.json({ 
      success: true, 
      data: allPatients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });`;

code = code.replace(targetStr, newStr);
fs.writeFileSync(file, code);
