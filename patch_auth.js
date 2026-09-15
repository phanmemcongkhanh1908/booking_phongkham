import fs from 'fs';
const file = 'src/store/auth.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("localStorage.getItem('token')", "localStorage.getItem('admin_token')");
code = code.replace("localStorage.getItem('user')", "localStorage.getItem('admin_user')");
code = code.replace("localStorage.setItem('token', token)", "localStorage.setItem('admin_token', token)");
code = code.replace("localStorage.setItem('user', JSON.stringify(user))", "localStorage.setItem('admin_user', JSON.stringify(user))");
code = code.replace("localStorage.removeItem('token')", "localStorage.removeItem('admin_token')");
code = code.replace("localStorage.removeItem('user')", "localStorage.removeItem('admin_user')");

fs.writeFileSync(file, code);
