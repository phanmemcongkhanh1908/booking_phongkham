import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0846632471",
  appId: "1:365423273937:web:33ad75dfa2e56c89ae62f0",
  apiKey: "AIzaSyCFKVU2M91xbRmpeVaRPtjHhNr1hcL1M5Q",
  authDomain: "gen-lang-client-0846632471.firebaseapp.com",
  storageBucket: "gen-lang-client-0846632471.firebasestorage.app",
  messagingSenderId: "365423273937"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = null;
export { RecaptchaVerifier, signInWithPhoneNumber };

