import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.SQL_HOST || "",
    user: process.env.SQL_USER || "",
    password: process.env.SQL_PASSWORD || "",
    database: process.env.SQL_DB_NAME || "",
  }
});
