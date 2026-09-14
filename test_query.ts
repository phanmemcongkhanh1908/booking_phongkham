import { db } from './server/db/index.js';
import { patients, appointments, services, providers } from './server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function run() {
  const phone = '0912345678';
  const pts = await db.select().from(patients).where(eq(patients.phone, phone));
  console.log("Patients found:", pts.length);
  
  if (pts.length > 0) {
    const patientIds = pts.map(p => p.id);
    let query = db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      serviceId: appointments.serviceId,
      serviceName: services.name,
      providerName: providers.name
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(providers, eq(appointments.providerId, providers.id))
    .where(inArray(appointments.patientId, patientIds));
    
    const results = await query;
    console.log("Results from DB:", results.length);
  }
}
run().catch(console.error).then(() => process.exit(0));
