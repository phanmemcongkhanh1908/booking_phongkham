import { Firestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const db = new Firestore({
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
});

async function test() {
  try {
    const res = await db.collection('services').get();
    console.log("Success raw:", res.docs.length);
  } catch (e) {
    console.error("Error raw:", e.message);
  }
}
test();
