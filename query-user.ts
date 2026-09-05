import { db } from './server/db/index.js';
import { users, roles } from './server/db/schema.js';
import { eq } from 'drizzle-orm';
async function run() {
  const u = await db.select().from(users).leftJoin(roles, eq(users.roleId, roles.id));
  console.log(JSON.stringify(u, null, 2));
  process.exit(0);
}
run();
