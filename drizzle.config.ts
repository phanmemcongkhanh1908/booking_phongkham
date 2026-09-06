import { defineConfig } from "drizzle-kit";
import fs from "fs";

// 1. Connection URL (Standard for Neon & Render)
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_URL || "";

// 2. Individual environment variables (supporting multiple naming conventions)
let host = process.env.SQL_HOST || process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST || "";
let user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER || "";
let password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || "";
let database = process.env.SQL_DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || process.env.DB_NAME || "";
let port = Number(process.env.SQL_PORT || process.env.PGPORT || 5432);
let ssl: boolean | object = false;

// If a connection string is present, parse it to extract any missing credentials
if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    if (!host) host = parsed.hostname;
    if (!user) user = decodeURIComponent(parsed.username);
    if (!password) password = decodeURIComponent(parsed.password);
    if (!database) database = parsed.pathname.replace(/^\//, "");
    if (parsed.port) port = Number(parsed.port);
    if (parsed.searchParams.get("sslmode") === "require" || host.includes("neon.tech")) {
      ssl = true;
    }
  } catch (e) {
    // Ignore URL parse error
  }
}

if (host.startsWith("/app/cloudsql/")) {
  if (!fs.existsSync(host)) {
    try {
      const dirs = fs.readdirSync("/app/cloudsql/");
      if (dirs.length > 0) {
        host = "/app/cloudsql/" + dirs[0];
      }
    } catch (e) {}
  }
}

if (host.includes("neon.tech") || process.env.NODE_ENV === "production") {
  ssl = true;
}

// Build credentials
const dbCredentials: any = {};

if (dbUrl) {
  dbCredentials.url = dbUrl;
} else if (host && user && password) {
  dbCredentials.host = host;
  dbCredentials.port = port;
  dbCredentials.user = user;
  dbCredentials.password = password;
  dbCredentials.database = database || "neondb";
  if (ssl) {
    dbCredentials.ssl = true;
  }
} else {
  if (host) dbCredentials.host = host;
  if (user) dbCredentials.user = user;
  if (password) dbCredentials.password = password;
  if (database) dbCredentials.database = database;
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials,
});
