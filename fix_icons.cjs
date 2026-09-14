const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// I also used MoreVertical in the code. Let's check if it's imported.
if (!content.includes('MoreVertical,')) {
    content = content.replace("Trash2,", "Trash2, MoreVertical,");
}
fs.writeFileSync('src/pages/admin/Patients.tsx', content);
