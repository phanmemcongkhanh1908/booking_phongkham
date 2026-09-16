import fs from 'fs';
let file = 'src/vite-env.d.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('recaptchaVerifier')) {
  code += `\n\ninterface Window {\n  recaptchaVerifier: any;\n}\n`;
  fs.writeFileSync(file, code);
}
