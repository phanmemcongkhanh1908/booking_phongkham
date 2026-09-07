import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreInstance;
const dbId = (firebaseConfig as any).firestoreDatabaseId;
try {
  firestoreInstance = dbId
    ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true }, dbId)
    : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
} catch {
  firestoreInstance = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
}

export const serverDb = firestoreInstance;
