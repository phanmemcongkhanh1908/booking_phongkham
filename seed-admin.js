const { db } = require('./dist/server.cjs');
const { users, roles } = require('./dist/server.cjs').schema || {};
const argon2 = require('argon2');

async function seed() {
  if(!db) { console.error("DB not found"); return; }
  try {
    const hash = await argon2.hash('123456');
    const resRole = await db.execute(`INSERT INTO roles (name, permissions) VALUES ('admin', '["*"]') ON CONFLICT (name) DO UPDATE SET permissions = '["*"]' RETURNING id`);
    const roleId = resRole.rows[0].id;
    await db.execute(`INSERT INTO users (email, password_hash, role_id) VALUES ('admin@dentalsmartbooking.com', '${hash}', '${roleId}') ON CONFLICT (email) DO UPDATE SET password_hash = '${hash}', role_id = '${roleId}'`);
    console.log("Admin seeded");
  } catch (e) { console.error(e) }
}
seed();
