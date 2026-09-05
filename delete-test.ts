import { db } from './server/db/index.js';
import { appointments } from './server/db/schema.js';
import { eq } from 'drizzle-orm';
async function run() {
  try {
    const id = '195aec80-21e7-499c-abf5-277c6669edb6';
    await db.delete(appointments).where(eq(appointments.id, id));
    console.log("Deleted!");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
