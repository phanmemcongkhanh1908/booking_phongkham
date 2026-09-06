import { defineConfig } from "drizzle-kit";

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
    user: process.env.SQL_ADMIN_USER || "",
    password: process.env.SQL_ADMIN_PASSWORD || "",
    database: process.env.SQL_DB_NAME || "",
  }
});
