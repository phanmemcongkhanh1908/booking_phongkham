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
  connect: (options?: { prompt?: string }) => Promise<{ accessToken: string; user: GoogleUserProfile }>;
  disconnect: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
  setSpreadsheetInfo: (id: string, url: string) => void;
  setDriveFolderId: (id: string) => void;
  setLastSyncAt: (timestamp: string) => void;
  setWarningDismissed: (dismissed: boolean) => void;
  
  // Custom Google Client ID (for custom domains like Render, Vercel, etc.)
  customClientId: string | null;
  activeClientId: string;
  setCustomClientId: (clientId: string) => void;
}

const STORAGE_KEY_CONFIG = 'dental_google_backup_meta';
const CUSTOM_CLIENT_ID_KEY = 'dental_google_custom_client_id';

const getEnv = (key: string): string => {
  try {
    return (import.meta as any)?.env?.[key] || '';
  } catch (e) {
    return '';
  }
};

const getInitialClientId = (): string => {
  try {
    const saved = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {}
  const envClientId = getEnv('VITE_GOOGLE_CLIENT_ID');
  if (envClientId) {
    return envClientId.trim();
  }
  return firebaseConfig.oAuthClientId || '';
};

// In-memory token cache per security instructions
let inMemoryAccessToken: string | null = null;

export const useGoogleAuthStore = create<GoogleAuthState>((set, get) => {
  // Read saved non-sensitive metadata from localStorage (never secrets/tokens)
  let savedMeta: any = {};
  let savedCustomClientId: string | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) savedMeta = JSON.parse(raw);
    savedCustomClientId = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
  } catch (e) {
    console.error('Failed to read saved google meta:', e);
  }

  const envClientId = getEnv('VITE_GOOGLE_CLIENT_ID');
  const initialActiveClientId = (savedCustomClientId && savedCustomClientId.trim()) 
    || envClientId 
    || firebaseConfig.oAuthClientId 
    || '';

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
    customClientId: savedCustomClientId ? savedCustomClientId.trim() : null,
    activeClientId: initialActiveClientId,

    setCustomClientId: (clientId: string) => {
      const trimmed = clientId.trim();
      try {
        if (trimmed) {
          localStorage.setItem(CUSTOM_CLIENT_ID_KEY, trimmed);
        } else {
          localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
        }
      } catch (e) {}
      const active = trimmed || getEnv('VITE_GOOGLE_CLIENT_ID') || firebaseConfig.oAuthClientId || '';
      set({ 
        customClientId: trimmed || null, 
        activeClientId: active 
      });
    },

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

    connect: async (options?: { prompt?: string }) => {
      set({ isConnecting: true, error: null });

      const handleSuccess = (token: string, userProfile: GoogleUserProfile) => {
        inMemoryAccessToken = token;
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
          warningDismissed: false,
        });

        return { accessToken: token, user: userProfile };
      };

      // 1. Primary: Google Identity Services (GSI token client)
      // Directly handles popup and tokens with Drive & Sheets scopes without relying on iframe cookies
      const winGoogle = typeof window !== 'undefined' ? (window as any).google : undefined;
      const clientIdToUse = get().activeClientId || getInitialClientId();
      if (winGoogle?.accounts?.oauth2 && clientIdToUse) {
        try {
          console.log('[Google Auth] Connecting via Google Identity Services (GSI) with clientId:', clientIdToUse);
          const gsiResult = await new Promise<{ accessToken: string; user: GoogleUserProfile }>((resolve, reject) => {
            const tokenClient = winGoogle.accounts.oauth2.initTokenClient({
              client_id: clientIdToUse,
              scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
              callback: async (resp: any) => {
                if (resp.error) {
                  const isDenied = 
                    resp.error === 'access_denied' || 
                    resp.error_subtype === 'access_denied' ||
                    (typeof resp.error_description === 'string' && resp.error_description.toLowerCase().includes('access_denied'));

                  if (isDenied) {
                    // Chi tiết logging cho trường hợp access_denied
                    console.error('[Google Auth][ACCESS_DENIED] Google OAuth trả về lỗi access_denied:', {
                      error: resp.error,
                      error_subtype: resp.error_subtype,
                      error_description: resp.error_description,
                      clientId: clientIdToUse,
                      timestamp: new Date().toISOString(),
                      origin: typeof window !== 'undefined' ? window.location.origin : '',
                      reason: 'Tài khoản Google này bị từ chối truy cập. Nguyên nhân thường gặp: Email chưa được thêm vào Admin Whitelist hoặc Test Users trên Google Cloud Console (khi OAuth ở chế độ thử nghiệm).'
                    });

                    const accessErr = new Error(
                      resp.error_description 
                        ? `Truy cập bị từ chối (access_denied): ${resp.error_description}` 
                        : 'Tài khoản Google bị từ chối truy cập (access_denied). Vui lòng thêm email này vào Admin Whitelist.'
                    );
                    (accessErr as any).code = 'auth/access-denied';
                    (accessErr as any).isAccessDenied = true;
                    (accessErr as any).rawDetails = resp;
                    return reject(accessErr);
                  }

                  if (resp.error === 'user_closed_popup') {
                    console.info('[Google Auth] Cửa sổ popup Google đã được đóng bởi người dùng.');
                    const err = new Error('Cửa sổ đăng nhập Google đã được đóng.');
                    (err as any).code = 'auth/popup-closed-by-user';
                    (err as any).isCancelled = true;
                    return reject(err);
                  }

                  console.error('[Google Auth] Lỗi phản hồi OAuth từ Google GSI:', resp);
                  return reject(new Error(resp.error_description || resp.error));
                }

                const token = resp.access_token;
                if (!token) {
                  return reject(new Error('Không nhận được Google Access Token.'));
                }
                try {
                  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const info = await res.json();
                  resolve({
                    accessToken: token,
                    user: {
                      email: info.email || null,
                      displayName: info.name || null,
                      photoURL: info.picture || null,
                      uid: info.sub || 'google-user'
                    }
                  });
                } catch {
                  resolve({
                    accessToken: token,
                    user: {
                      email: null,
                      displayName: 'Tài khoản Google',
                      photoURL: null,
                      uid: 'google-user'
                    }
                  });
                }
              },
              error_callback: (err: any) => {
                const isDenied = 
                  err?.type === 'access_denied' ||
                  err?.error === 'access_denied' ||
                  (typeof err?.message === 'string' && err.message.toLowerCase().includes('access_denied'));

                if (isDenied) {
                  console.error('[Google Auth][ACCESS_DENIED] Google GSI error_callback báo lỗi access_denied:', {
                    rawError: err,
                    clientId: clientIdToUse,
                    timestamp: new Date().toISOString(),
                    reason: 'Email Google chưa được thêm vào Admin Whitelist hoặc Test Users.'
                  });
                  const accessErr = new Error('Tài khoản Google bị từ chối truy cập (access_denied). Vui lòng thêm email vào Admin Whitelist.');
                  (accessErr as any).code = 'auth/access-denied';
                  (accessErr as any).isAccessDenied = true;
                  (accessErr as any).rawDetails = err;
                  return reject(accessErr);
                }

                console.error('[Google Auth] GSI error_callback:', err);
                reject(err);
              }
            });
            tokenClient.requestAccessToken({ prompt: options?.prompt || 'consent' });
          });

          return handleSuccess(gsiResult.accessToken, gsiResult.user);
        } catch (gsiErr: any) {
          if (gsiErr?.isCancelled || gsiErr?.code === 'auth/popup-closed-by-user') {
            set({ isConnecting: false, error: null });
            throw gsiErr;
          }

          if (gsiErr?.isAccessDenied || gsiErr?.code === 'auth/access-denied') {
            console.error('[Google Auth][ACCESS_DENIED] Dừng luồng xác thực vì bị Google từ chối quyền (access_denied):', gsiErr);
            set({ 
              isConnecting: false, 
              error: 'Tài khoản Google bị từ chối truy cập (access_denied). Email cần được thêm vào danh sách Admin Whitelist.' 
            });
            throw gsiErr;
          }

          console.warn('[Google Auth] GSI connection error, falling back to Firebase Auth Popup:', gsiErr);
        }
      }

      // 2. Secondary: Firebase Auth Popup
      try {
        console.log('[Google Auth] Connecting via Firebase Auth popup...');
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (!token) {
          throw new Error('Không nhận được Google Access Token để cấp quyền truy cập Drive/Sheets.');
        }

        const userProfile: GoogleUserProfile = {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          uid: result.user.uid,
        };

        return handleSuccess(token, userProfile);
      } catch (err: any) {
        const isClosedByUser = 
          err?.code === 'auth/popup-closed-by-user' || 
          err?.code === 'auth/cancelled-popup-request' ||
          (typeof err?.message === 'string' && err.message.includes('popup-closed-by-user'));

        const isAccessDenied = 
          err?.code === 'auth/access-denied' || 
          err?.code === 'auth/user-disabled' ||
          err?.isAccessDenied ||
          (typeof err?.message === 'string' && (
            err.message.toLowerCase().includes('access_denied') ||
            err.message.toLowerCase().includes('access-denied') ||
            err.message.toLowerCase().includes('access denied')
          ));

        const isPopupBlocked = 
          err?.code === 'auth/popup-blocked' || 
          (typeof err?.message === 'string' && err.message.includes('popup-blocked'));

        const isUnauthorizedDomain =
          err?.code === 'auth/unauthorized-domain' ||
          (typeof err?.message === 'string' && err.message.includes('unauthorized-domain'));

        if (isClosedByUser) {
          console.info('[Google Auth] Đã đóng cửa sổ đăng nhập Google.');
          set({
            isConnecting: false,
            error: null,
          });
          const cancelError = new Error('Cửa sổ đăng nhập Google đã được đóng.');
          (cancelError as any).code = 'auth/popup-closed-by-user';
          (cancelError as any).isCancelled = true;
          throw cancelError;
        }

        if (isAccessDenied) {
          console.error('[Google Auth][ACCESS_DENIED] Firebase OAuth Popup gặp lỗi access_denied:', {
            code: err?.code,
            message: err?.message,
            customData: err?.customData,
            email: err?.customData?.email || err?.email,
            timestamp: new Date().toISOString(),
            reason: 'Tài khoản chưa được thêm vào Admin Whitelist hoặc Test Users trên Google Cloud Console.'
          });

          const accessDeniedMsg = 'Tài khoản Google bị từ chối truy cập (access_denied). Vui lòng thêm email vào danh sách Admin Whitelist.';
          set({
            isConnecting: false,
            error: accessDeniedMsg,
          });
          const accessErr = new Error(accessDeniedMsg);
          (accessErr as any).code = 'auth/access-denied';
          (accessErr as any).isAccessDenied = true;
          (accessErr as any).email = err?.customData?.email || err?.email;
          throw accessErr;
        }

        if (isPopupBlocked) {
          console.warn('[Google Auth] Trình duyệt đã chặn popup đăng nhập Google.');
          const blockedMsg = 'Trình duyệt đang chặn cửa sổ đăng nhập Google. Vui lòng cho phép popup trên thanh địa chỉ hoặc mở trang trong Tab Mới.';
          set({
            isConnecting: false,
            error: blockedMsg,
          });
          const blockedError = new Error(blockedMsg);
          (blockedError as any).code = 'auth/popup-blocked';
          throw blockedError;
        }

        if (isUnauthorizedDomain) {
          const domainMsg = 'Tên miền hiện tại cần được xác thực hoặc mở trong tab mới để kết nối Google.';
          set({
            isConnecting: false,
            error: domainMsg,
          });
          const domainErr = new Error(domainMsg);
          (domainErr as any).code = 'auth/unauthorized-domain';
          throw domainErr;
        }

        console.error('Google Sign-In Error:', err);
        const errorMessage = err?.message || 'Lỗi khi kết nối tài khoản Google';
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
