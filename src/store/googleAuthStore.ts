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

export interface DailyBackupRecord {
  date: string;
  fileName: string;
  fileUrl: string;
  totalAppointments: number;
  backedUpAt: string;
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

  // Daily Google Drive summary backup config (non-sensitive metadata only)
  driveBackupFolderId: string | null;
  driveBackupFolderName: string;
  autoDailyDriveBackupEnabled: boolean;
  dailyBackupHour: string;
  lastDailyBackupDate: string | null;
  lastDailyBackupAt: string | null;
  lastDailyBackupFileUrl: string | null;
  recentDailyBackups: DailyBackupRecord[];
  
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
  setDailyDriveBackupConfig: (config: {
    driveBackupFolderId?: string | null;
    driveBackupFolderName?: string;
    autoDailyDriveBackupEnabled?: boolean;
    dailyBackupHour?: string;
  }) => void;
  recordDailyDriveBackupResult: (record: DailyBackupRecord & { folderId?: string }) => void;
  setWarningDismissed: (dismissed: boolean) => void;
  
  // Custom Google Client ID (for custom domains like Render, Vercel, etc.)
  customClientId: string | null;
  serverClientId: string | null;
  activeClientId: string;
  setCustomClientId: (clientId: string) => void;
  syncServerClientId: (clinicSlugOrTenant?: string) => Promise<string>;
}

const STORAGE_KEY_CONFIG = 'dental_google_backup_meta';
const CUSTOM_CLIENT_ID_KEY = 'dental_google_custom_client_id';
const SESSION_TOKEN_KEY = 'dental_google_access_token';
const AUTH_METHOD_KEY = 'dental_google_auth_method';

const RENDER_PROD_HOSTS = new Set([
  'booking-phongkham.onrender.com',
  'www.booking-phongkham.onrender.com',
]);

// OAuth Client ID thuộc Google Cloud Project "Booking-phongkham" cho tên miền Render
const RENDER_DEFAULT_GOOGLE_CLIENT_ID =
  '330071367512-mfo4q3vr1iof1ou4tv6i1ohbsg7al61s.apps.googleusercontent.com';

const getEnv = (key: string): string => {
  try {
    return (import.meta as any)?.env?.[key] || '';
  } catch (e) {
    return '';
  }
};

const getDefaultDomainClientId = (): string => {
  const envClientId = getEnv('VITE_GOOGLE_CLIENT_ID').trim();
  if (envClientId) return envClientId;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (RENDER_PROD_HOSTS.has(hostname)) {
      return RENDER_DEFAULT_GOOGLE_CLIENT_ID;
    }
  }

  return (firebaseConfig.oAuthClientId || '').trim();
};

const resolveActiveClientId = (
  customClientId?: string | null,
  serverClientId?: string | null
): string => {
  const custom = (customClientId || '').trim();
  if (custom) return custom;

  const envClientId = getEnv('VITE_GOOGLE_CLIENT_ID').trim();
  if (envClientId) return envClientId;

  const srv = (serverClientId || '').trim();
  if (srv) return srv;

  return getDefaultDomainClientId();
};

const isFirebaseProjectClientId = (clientId: string): boolean => {
  const fbId = (firebaseConfig.oAuthClientId || '').trim();
  return Boolean(fbId && clientId === fbId);
};

const ensureGsiScriptLoaded = async (timeoutMs = 3500): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if ((window as any).google?.accounts?.oauth2) return true;

  return new Promise<boolean>((resolve) => {
    const startTime = Date.now();
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi/client"]'
    );

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const timer = window.setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startTime >= timeoutMs) {
        window.clearInterval(timer);
        resolve(Boolean((window as any).google?.accounts?.oauth2));
      }
    }, 80);
  });
};

// In-memory token cache backed by sessionStorage to survive page reloads (F5) within browser tab
const getStoredSessionToken = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(SESSION_TOKEN_KEY) || null;
    }
  } catch (e) {}
  return null;
};

const getStoredAuthMethod = (): 'gsi' | 'firebase' | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const val = sessionStorage.getItem(AUTH_METHOD_KEY);
      if (val === 'gsi' || val === 'firebase') return val;
    }
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.authMethod === 'gsi' || parsed?.authMethod === 'firebase') {
        return parsed.authMethod;
      }
    }
  } catch (e) {}
  return null;
};

let inMemoryAccessToken: string | null = getStoredSessionToken();
let serverConfigPromise: Promise<string> | null = null;

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

  const normalizedCustom = savedCustomClientId ? savedCustomClientId.trim() : null;
  const initialActiveClientId = resolveActiveClientId(normalizedCustom, null);

  const initialToken = inMemoryAccessToken || getStoredSessionToken();
  const isInitiallyLinked = !!(initialToken || savedMeta.user?.email);

  return {
    accessToken: initialToken,
    user: savedMeta.user || null,
    isConnected: isInitiallyLinked,
    isConnecting: false,
    error: null,
    spreadsheetId: savedMeta.spreadsheetId || localStorage.getItem('emr_spreadsheet_id') || null,
    spreadsheetUrl: savedMeta.spreadsheetUrl || null,
    driveFolderId: savedMeta.driveFolderId || null,
    lastSyncAt: savedMeta.lastSyncAt || null,
    driveBackupFolderId: savedMeta.driveBackupFolderId || null,
    driveBackupFolderName: savedMeta.driveBackupFolderName || 'Dental Smart - Sao lưu Lịch hẹn Hằng ngày',
    autoDailyDriveBackupEnabled:
      savedMeta.autoDailyDriveBackupEnabled !== undefined
        ? Boolean(savedMeta.autoDailyDriveBackupEnabled)
        : true,
    dailyBackupHour: savedMeta.dailyBackupHour || '20:00',
    lastDailyBackupDate: savedMeta.lastDailyBackupDate || null,
    lastDailyBackupAt: savedMeta.lastDailyBackupAt || null,
    lastDailyBackupFileUrl: savedMeta.lastDailyBackupFileUrl || null,
    recentDailyBackups: Array.isArray(savedMeta.recentDailyBackups) ? savedMeta.recentDailyBackups : [],
    warningDismissed: false,
    customClientId: normalizedCustom,
    serverClientId: null,
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
      const active = resolveActiveClientId(trimmed || null, get().serverClientId);
      set({
        customClientId: trimmed || null,
        activeClientId: active,
      });
    },

    syncServerClientId: async (clinicSlugOrTenant?: string) => {
      if (serverConfigPromise && !clinicSlugOrTenant) {
        return serverConfigPromise;
      }

      const fetchTask = (async () => {
        try {
          const qs = new URLSearchParams();
          if (clinicSlugOrTenant) {
            if (clinicSlugOrTenant.startsWith('tenant_')) {
              qs.set('tenantId', clinicSlugOrTenant);
            } else {
              qs.set('clinic', clinicSlugOrTenant);
            }
          }
          const url = `/api/public/google-oauth-config${qs.toString() ? `?${qs.toString()}` : ''}`;
          const res = await fetch(url);
          if (res.ok) {
            const payload = await res.json();
            const srvClientId = typeof payload?.data?.clientId === 'string'
              ? payload.data.clientId.trim()
              : '';
            const active = resolveActiveClientId(get().customClientId, srvClientId || null);
            set({
              serverClientId: srvClientId || null,
              activeClientId: active,
            });
            return active;
          }
        } catch (err) {
          console.warn('[Google Auth] Could not sync runtime OAuth config from server:', err);
        }
        return get().activeClientId;
      })();

      if (!clinicSlugOrTenant) {
        serverConfigPromise = fetchTask;
      }
      return fetchTask;
    },

    init: () => {
      // Preload GSI script & sync runtime server Client ID early so click handler stays synchronous
      void ensureGsiScriptLoaded();
      void get().syncServerClientId();

      // Listen to Firebase Auth state (only applies if connected via Firebase popup)
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
            isConnected: !!(inMemoryAccessToken || userProfile.email),
          });
        } else {
          // CRITICAL: GSI token flow does not create a Firebase Auth user.
          // Do NOT wipe GSI tokens or disconnect state when Firebase reports null.
          const authMethod = getStoredAuthMethod();
          const currentState = get();
          if (authMethod === 'gsi' || (!authMethod && (inMemoryAccessToken || currentState.user?.email))) {
            return;
          }
          inMemoryAccessToken = null;
          set({
            accessToken: null,
            user: null,
            isConnected: false,
          });
        }
      });

      return unsubscribe;
    },

    connect: async (options?: { prompt?: string }) => {
      if (get().isConnecting) {
        const inProgressErr = new Error('Đang mở cửa sổ kết nối Google, vui lòng hoàn tất trong cửa sổ hiện tại.');
        (inProgressErr as any).code = 'auth/cancelled-popup-request';
        (inProgressErr as any).isCancelled = true;
        throw inProgressErr;
      }
      set({ isConnecting: true, error: null });

      const handleSuccess = (token: string, userProfile: GoogleUserProfile, method: 'gsi' | 'firebase') => {
        inMemoryAccessToken = token;
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(SESSION_TOKEN_KEY, token);
            sessionStorage.setItem(AUTH_METHOD_KEY, method);
          }
          const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
            ...prev,
            user: userProfile,
            authMethod: method,
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

      const clientIdToUse =
        get().activeClientId ||
        resolveActiveClientId(get().customClientId, get().serverClientId);

      // Ensure GSI script is available before deciding path (prevents accidental Firebase fallback when GSI loads slowly)
      let winGoogle = typeof window !== 'undefined' ? (window as any).google : undefined;
      if (!winGoogle?.accounts?.oauth2 && clientIdToUse) {
        await ensureGsiScriptLoaded(3500);
        winGoogle = typeof window !== 'undefined' ? (window as any).google : undefined;
      }

      // 1. Primary: Google Identity Services (GSI token client)
      // Directly handles popup and tokens with Drive & Sheets scopes without relying on iframe cookies
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

                  const errStr = `${resp.error || ''} ${resp.error_description || ''}`.toLowerCase();
                  if (errStr.includes('origin_mismatch') || errStr.includes('redirect_uri_mismatch')) {
                    const originErr = new Error(
                      'Tên miền hiện tại chưa khớp với Authorized JavaScript origins trên Google Cloud Console (Lỗi 400: origin_mismatch).'
                    );
                    (originErr as any).code = 'origin_mismatch';
                    return reject(originErr);
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
                if (err?.type === 'popup_closed') {
                  console.info('[Google Auth] Cửa sổ popup Google GSI đã được đóng bởi người dùng.');
                  const cancelErr = new Error('Cửa sổ đăng nhập Google đã được đóng.');
                  (cancelErr as any).code = 'auth/popup-closed-by-user';
                  (cancelErr as any).isCancelled = true;
                  return reject(cancelErr);
                }

                if (err?.type === 'popup_failed_to_open') {
                  console.warn('[Google Auth] Trình duyệt đã chặn popup Google GSI.');
                  const blockedErr = new Error('Trình duyệt đang chặn cửa sổ đăng nhập Google. Vui lòng cho phép popup trên thanh địa chỉ hoặc thử mở ở tab mới.');
                  (blockedErr as any).code = 'auth/popup-blocked';
                  return reject(blockedErr);
                }

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
                  const accessErr = new Error('Tài khoản Google bị từ chối truy cập (access_denied). Vui lòng thêm email vào Admin Whitelist hoặc Test Users trên Google Cloud Console.');
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

          return handleSuccess(gsiResult.accessToken, gsiResult.user, 'gsi');
        } catch (gsiErr: any) {
          if (gsiErr?.isCancelled || gsiErr?.code === 'auth/popup-closed-by-user' || gsiErr?.code === 'auth/cancelled-popup-request') {
            set({ isConnecting: false, error: null });
            throw gsiErr;
          }

          if (gsiErr?.isAccessDenied || gsiErr?.code === 'auth/access-denied') {
            console.error('[Google Auth][ACCESS_DENIED] Dừng luồng xác thực vì bị Google từ chối quyền (access_denied):', gsiErr);
            set({ 
              isConnecting: false, 
              error: 'Tài khoản Google bị từ chối truy cập (access_denied). Email cần được thêm vào danh sách Admin Whitelist hoặc Test Users.' 
            });
            throw gsiErr;
          }

          // Do not spawn a second Firebase Auth popup when GSI already ran — it opens duplicate error popups.
          const errMessage = gsiErr?.message || 'Không thể kết nối Google OAuth từ tên miền này. Vui lòng kiểm tra Authorized JavaScript origins hoặc Client ID.';
          set({ isConnecting: false, error: errMessage });
          throw gsiErr;
        }
      }

      // If we are on a custom/Render Client ID (not AI Studio's internal Firebase project),
      // never fall back to gen-lang-client Firebase Auth popup when GSI script was blocked.
      if (clientIdToUse && !isFirebaseProjectClientId(clientIdToUse)) {
        const gsiBlockedMsg =
          'Không tải được thư viện đăng nhập Google (accounts.google.com/gsi/client). Vui lòng tắt trình chặn quảng cáo/khiên bảo mật trình duyệt hoặc tải lại trang rồi thử lại.';
        set({ isConnecting: false, error: gsiBlockedMsg });
        throw new Error(gsiBlockedMsg);
      }

      // 2. Secondary: Firebase Auth Popup (only for AI Studio / localhost using Firebase's own Client ID)
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

        return handleSuccess(token, userProfile, 'firebase');
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
      const tokenToRevoke = inMemoryAccessToken;
      try {
        const winGoogle = typeof window !== 'undefined' ? (window as any).google : undefined;
        if (tokenToRevoke && winGoogle?.accounts?.oauth2?.revoke) {
          winGoogle.accounts.oauth2.revoke(tokenToRevoke, () => {});
        }
      } catch (e) {}
      try {
        await signOut(auth);
      } catch (e) {
        console.error('SignOut error:', e);
      }
      inMemoryAccessToken = null;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          sessionStorage.removeItem(AUTH_METHOD_KEY);
        }
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
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          if (token) {
            sessionStorage.setItem('dental_google_access_token', token);
          } else {
            sessionStorage.removeItem('dental_google_access_token');
          }
        }
      } catch (e) {}
      set({ accessToken: token, isConnected: !!(token || get().user?.email) });
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

    setDailyDriveBackupConfig: (config) => {
      const nextPatch: Record<string, any> = {};
      if (config.driveBackupFolderId !== undefined) nextPatch.driveBackupFolderId = config.driveBackupFolderId;
      if (config.driveBackupFolderName !== undefined) nextPatch.driveBackupFolderName = config.driveBackupFolderName;
      if (config.autoDailyDriveBackupEnabled !== undefined) {
        nextPatch.autoDailyDriveBackupEnabled = config.autoDailyDriveBackupEnabled;
      }
      if (config.dailyBackupHour !== undefined) nextPatch.dailyBackupHour = config.dailyBackupHour;
      set(nextPatch);
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
          ...prev,
          ...nextPatch,
        }));
      } catch (e) {}
    },

    recordDailyDriveBackupResult: (record) => {
      const prevList = get().recentDailyBackups || [];
      const nextList = [record, ...prevList.filter((r) => r.fileUrl !== record.fileUrl)].slice(0, 7);
      const nextPatch: Record<string, any> = {
        lastDailyBackupDate: record.date,
        lastDailyBackupAt: record.backedUpAt,
        lastDailyBackupFileUrl: record.fileUrl,
        recentDailyBackups: nextList,
        ...(record.folderId ? { driveBackupFolderId: record.folderId } : {}),
      };
      set(nextPatch);
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY_CONFIG) || '{}');
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
          ...prev,
          ...nextPatch,
        }));
      } catch (e) {}
    },

    setWarningDismissed: (dismissed: boolean) => {
      set({ warningDismissed: dismissed });
    },
  };
});

export { auth, provider };
