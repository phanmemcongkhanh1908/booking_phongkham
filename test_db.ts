import { db } from './server/db/index.js';
import { patients, appointments } from './server/db/schema.js';

async function check() {
  const pts = await db.select().from(patients);
  console.log("Patients:", pts);
  
  const apts = await db.select().from(appointments);
  console.log("Appointments:", apts);
}
check().catch(console.error).then(() => process.exit(0));
