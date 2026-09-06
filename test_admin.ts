import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

console.log("Config projectId:", firebaseConfig.projectId);
console.log("Config dbId:", firebaseConfig.firestoreDatabaseId);

const app = initializeApp({ projectId: firebaseConfig.projectId });
const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const res = await adminDb.collection('services').get();
    console.log("Success:", res.docs.length);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
