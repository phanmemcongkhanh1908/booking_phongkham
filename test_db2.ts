import { db } from './server/db/index.js';
import { patients } from './server/db/schema.js';
import { eq } from 'drizzle-orm';
async function test() {
  const pt = await db.select().from(patients).where(eq(patients.phone, "0912345678"));
  console.log("Patients with phone:", pt);
}
test().catch(console.error).then(() => process.exit(0));
