import fs from 'fs';
let file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("process.env.TZ")) {
  code = "process.env.TZ = 'Asia/Ho_Chi_Minh';\n" + code;
  fs.writeFileSync(file, code);
}
