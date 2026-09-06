import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp({ projectId: firebaseConfig.projectId });

async function test() {
  try {
    const adminDb = getFirestore(app);
    const collections = await adminDb.listCollections();
    console.log("Success adminDb default collections:", collections.map(c => c.id));
  } catch (e) {
    console.error("Error adminDb default:", e.message);
  }
}
test();
