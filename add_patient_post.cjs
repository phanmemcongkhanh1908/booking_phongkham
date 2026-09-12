const fs = require('fs');

const filePath = 'server/api/patients/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

const getRoute = `patientsRouter.get("/:id", requireAuth, async (req, res, next) => {`;

const postRoute = `patientsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const newPatient = await db.insert(patients).values({
      fullName: req.body.fullName,
      phone: req.body.phone,
      dob: req.body.dob,
      gender: req.body.gender,
      notes: req.body.notes,
    }).returning();
    res.json({ success: true, data: newPatient[0] });
  } catch (error) {
    next(error);
  }
});\n\n`;

content = content.replace(getRoute, postRoute + getRoute);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated patients router");
