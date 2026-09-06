const fs = require('fs');
const path = 'drizzle.config.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
import fs from "fs";

let host = process.env.SQL_HOST || "";
if (host.startsWith('/app/cloudsql/')) {
  if (!fs.existsSync(host)) {
    try {
      const dirs = fs.readdirSync('/app/cloudsql/');
      if (dirs.length > 0) {
        host = '/app/cloudsql/' + dirs[0];
      }
    } catch (e) {}
  }
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host,
    user: process.env.SQL_USER || "",
    password: process.env.SQL_PASSWORD || "",
    database: process.env.SQL_DB_NAME || "",
  }
});
`;

content = content.replace(/export default defineConfig\(\{[\s\S]*?\}\);/, replacement.trim());

fs.writeFileSync(path, content);
