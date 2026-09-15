import fs from 'fs';
let file = 'src/store/auth.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "logout: () => {",
  "logout: () => {\n    const currentUser = JSON.parse(localStorage.getItem('admin_user') || 'null');\n    if (currentUser?.slug) {\n      localStorage.setItem('last_clinic_slug', currentUser.slug);\n    }"
);

fs.writeFileSync(file, code);
