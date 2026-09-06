import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId
});
const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const res = await adminDb.collection('services').get();
    console.log("Success adminDb:", res.docs.length);
  } catch (e) {
    console.error("Error adminDb:", e.message);
  }
}
test();
