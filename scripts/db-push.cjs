const { execSync } = require("child_process");

function run() {
  console.log("[db:push] Checking database configuration before push...");

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_URL;
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER;
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;
  const host = process.env.SQL_HOST || process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST;

  // If no DATABASE_URL and missing user or password or host
  if (!dbUrl && (!user || !password || !host)) {
    console.warn("[db:push] Notice: PostgreSQL credentials (DATABASE_URL or user/password/host) are incomplete.");
    console.warn("[db:push] Skipping 'drizzle-kit push' to allow application server to start normally.");
    process.exit(0);
  }

  try {
    console.log("[db:push] Executing drizzle-kit push...");
    execSync("npx drizzle-kit push", { stdio: "inherit" });
    console.log("[db:push] Schema push completed successfully.");
  } catch (error) {
    console.warn("[db:push] Warning: drizzle-kit push exited with an error. Continuing startup so server can run.");
    // Exit with 0 so chained commands like 'npm run db:push && npm start' do not fail deployment
    process.exit(0);
  }
}

run();
