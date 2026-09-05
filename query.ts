import { db } from './server/db/index.js';
import { appointments } from './server/db/schema.js';
async function run() {
  const all = await db.select().from(appointments);
  console.log(all);
  process.exit(0);
}
run();
