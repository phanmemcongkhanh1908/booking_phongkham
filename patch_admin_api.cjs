const fs = require('fs');
let content = fs.readFileSync('server/api/admin/index.ts', 'utf8');

// Update POST
content = content.replace(
  /name: req\.body\.name,\n\s*specialty: req\.body\.specialty,\n\s*workingHours: req\.body\.workingHours \|\| \{\},/,
  `name: req.body.name,
      specialty: req.body.specialty,
      experience: req.body.experience,
      specialties: req.body.specialties,
      certificates: req.body.certificates,
      workingHours: req.body.workingHours || {},`
);

// Update PUT
content = content.replace(
  /name: req\.body\.name,\n\s*specialty: req\.body\.specialty,\n\s*workingHours: req\.body\.workingHours \|\| \{\},/g,
  `name: req.body.name,
      specialty: req.body.specialty,
      experience: req.body.experience,
      specialties: req.body.specialties,
      certificates: req.body.certificates,
      workingHours: req.body.workingHours || {},`
);

fs.writeFileSync('server/api/admin/index.ts', content);
