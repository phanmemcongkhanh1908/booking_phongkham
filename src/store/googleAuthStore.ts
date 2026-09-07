import { create } from 'zustand';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'select_account'
});

export interface GoogleUserProfile {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uid: string;
}

interface GoogleAuthState {
  accessToken: string | null;
  user: GoogleUserProfile | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Google Sheets & Drive state
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  driveFolderId: string | null;
  lastSyncAt: string | null;
  
  // UI warning dismissal for the session
  warningDismissed: boolean;

  // Actions
  init: () => () => void;
  connect: () => Promise<{ accessToken: string; user: GoogleUserProfile }>;
  disconnect: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
  setSpreadsheetInfo: (id: string, url: string) => void;
  setDriveFolderId: (id: string) => void;
  setLastSyncAt: (timestamp: string) => void;
  setWarningDismissed: (dismissed: boolean) => void;
}

const STORAGE_KEY_CONFIG = 'dental_google_backup_meta';

// In-memory token cache per security instructions
let inMemoryAccessToken: string | null = null;

export const useGoogleAuthStore = create<GoogleAuthState>((set, get) => {
  // Read saved non-sensitive metadata from localStorage (never secrets/tokens)
  let savedMeta: any = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) savedMeta = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read saved google meta:', e);
  }

  return {
    accessToken: inMemoryAccessToken,
    user: savedMeta.user || null,
    isConnected: !!inMemoryAccessToken,
    isConnecting: false,
    error: null,
    spreadsheetId: savedMeta.spreadsheetId || localStorage.getItem('emr_spreadsheet_id') || null,
    spreadsheetUrl: savedMeta.spreadsheetUrl || null,
    driveFolderId: savedMeta.driveFolderId || null,
    lastSyncAt: savedMeta.lastSyncAt || null,
    warningDismissed: false,

    init: () => {
      // Listen to Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        if (firebaseUser) {
          const userProfile: GoogleUserProfile = {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid,
          };
          set({
            user: userProfile,
            isConnected: !!inMemoryAccessToken,
          });
        } else {
          // If signed out of Firebase, clear memory token
          inMemoryAccessToken = null;
          set({
            accessToken: null,
            isConnected: false,
          });
        }
      });

      return unsubscribe;
    },

    connect: async () => {
      set({ isConnecting: true, error: null });
      try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (!token) {
          throw new Error('Không nhận được Google Access Token để cấp quyền truy cập Drive/Sheets.');
        }

        inMemoryAccessToken = token;
        const userProfile: GoogleUserProfile = {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          uid: result.user.uid,
        };

        // Save non-sensitive metadata to remember clinic's connected identity
        try {
          const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
            ...prev,
            user: userProfile,
            connectedAt: new Date().toISOString()
          }));
        } catch(e) {}

        set({
          accessToken: token,
          user: userProfile,
          isConnected: true,
          isConnecting: false,
          error: null,
          warningDismissed: false, // Reset warning once connected
        });

        return { accessToken: token, user: userProfile };
      } catch (err: any) {
        console.error('Google Sign-In Error:', err);
        const errorMessage = err.message || 'Lỗi khi kết nối tài khoản Google';
        set({
          isConnecting: false,
          error: errorMessage,
        });
        throw err;
      }
    },

    disconnect: async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('SignOut error:', e);
      }
      inMemoryAccessToken = null;
      try {
        localStorage.removeItem(STORAGE_KEY_CONFIG);
      } catch(e) {}

      set({
        accessToken: null,
        user: null,
        isConnected: false,
        warningDismissed: false,
      });
    },

    setAccessToken: (token: string | null) => {
      inMemoryAccessToken = token;
      set({ accessToken: token, isConnected: !!token });
    },

    setSpreadsheetInfo: (id: string, url: string) => {
      set({ spreadsheetId: id, spreadsheetUrl: url });
      try {
        localStorage.setItem('emr_spreadsheet_id', id);
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
          ...prev,
          spreadsheetId: id,
          spreadsheetUrl: url,
        }));
      } catch (e) {}
    },

    setDriveFolderId: (id: string) => {
      set({ driveFolderId: id });
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
          ...prev,
          driveFolderId: id,
        }));
      } catch (e) {}
    },

    setLastSyncAt: (timestamp: string) => {
      set({ lastSyncAt: timestamp });
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
          ...prev,
          lastSyncAt: timestamp,
        }));
      } catch (e) {}
    },

    setWarningDismissed: (dismissed: boolean) => {
      set({ warningDismissed: dismissed });
    },
  };
});

export { auth, provider };
