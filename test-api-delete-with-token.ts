import { db } from './server/db/index.js';
import { appointments, patients, services, providers } from './server/db/schema.js';
import axios from 'axios';
async function run() {
  const p = await db.select().from(patients).limit(1);
  const s = await db.select().from(services).limit(1);
  const pr = await db.select().from(providers).limit(1);

  const inserted = await db.insert(appointments).values({
    patientId: p[0].id,
    serviceId: s[0].id,
    providerId: pr[0].id,
    startAt: new Date(),
    endAt: new Date(Date.now() + 3600000),
  }).returning();

  const id = inserted[0].id;
  console.log("Inserted dummy apt", id);

  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWIxNDA1YS00YmY0LTRkOWEtODE4YS1lNGVlMzQ4ZTg2MmQiLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyIqIl0sImlhdCI6MTc4ODU2NzI5MywiZXhwIjoxNzg4NjUzNjkzfQ.puWzqPV0PKCmN_sSj87ZRvNSoom08qxL2m5eFcX3pBw';
  
  try {
    const res = await axios.delete('http://localhost:3000/api/appointments/' + id, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("API Delete response", res.data);
  } catch(e) {
    console.error("API Delete error", e.response?.data || e.message);
  }
  process.exit(0);
}
run();
