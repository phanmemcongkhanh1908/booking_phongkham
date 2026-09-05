const argon2 = require('argon2');
const { Pool } = require('pg');

async function seed() {
  const pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });

  try {
    const hash = await argon2.hash('123456');
    const resRole = await pool.query(`INSERT INTO roles (name, permissions) VALUES ('admin', '["*"]') ON CONFLICT (name) DO UPDATE SET permissions = '["*"]' RETURNING id`);
    const roleId = resRole.rows[0].id;
    await pool.query(`INSERT INTO users (email, password_hash, role_id) VALUES ('admin@dentalsmartbooking.com', $1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $1, role_id = $2`, [hash, roleId]);
    console.log("Admin seeded");
  } catch (e) { console.error(e) }
  finally { pool.end() }
}
seed();
