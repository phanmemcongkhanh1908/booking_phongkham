import fs from 'fs';
let file = 'server/api/patients/index.ts';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const allPatients = await db
      .select()
      .from(patients)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    const countQuery = await db.select({ id: patients.id }).from(patients);`;

const newStr = `patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const filter = req.query.filter as string || 'all';

    const conditions = [];
    if (search) {
       conditions.push(or(
         like(patients.fullName, \`%\${search}%\`),
         like(patients.phone, \`%\${search}%\`)
       ));
    }
    if (filter === 'debt') {
       conditions.push(gt(patients.debt, 0));
    }
    // For 'has_docs', we might need to check json if it's stored as JSON string. We can skip it here and just let client filter if needed, or check like '%documents%'.
    if (filter === 'has_docs') {
       conditions.push(like(patients.notes, '%"documents":[%{%]%'));
    }

    const allPatients = await db
      .select()
      .from(patients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    const countQuery = await db.select({ id: patients.id }).from(patients).where(conditions.length > 0 ? and(...conditions) : undefined);`;

code = code.replace(targetStr, newStr);

// add 'gt' and 'or' to imports if not present
if (!code.includes("import { eq, desc, like, or, gt, and }")) {
   code = code.replace(/import \{ eq, desc \} from "drizzle-orm";/g, 'import { eq, desc, like, or, gt, and } from "drizzle-orm";');
}

fs.writeFileSync(file, code);
