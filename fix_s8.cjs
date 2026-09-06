const fs = require('fs');
const path = 'server/core/security.ts';
let content = fs.readFileSync(path, 'utf8');

const s8Fix = `
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error("JWT_SECRET environment variable is missing. Refusing to start in production without a secure secret.");
}
const SECRET = JWT_SECRET || "default_zero_cost_secret_key_for_dev_only";
`;

content = content.replace(
  'const JWT_SECRET = process.env.JWT_SECRET || "default_zero_cost_secret_key_for_dev_only";',
  s8Fix
);

content = content.replace(/JWT_SECRET,/g, 'SECRET,');

fs.writeFileSync(path, content);
