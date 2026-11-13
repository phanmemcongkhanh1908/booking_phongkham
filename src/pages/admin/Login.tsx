import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Eye, EyeOff, Loader2, Building2, ShieldCheck, Lock, RefreshCw, Smartphone, Download, Share, PlusSquare, X } from 'lucide-react';
import UnauthorizedEmailModal, { UnauthorizedModalData } from './components/UnauthorizedEmailModal';
import { GoogleOriginHelpModal } from './components/GoogleOriginHelpModal';
import { useClinicSettings } from '../../hooks/useClinicSettings';
import { useAdminManifestBinding } from '../../hooks/useAdminMobileNotifications';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import toast from 'react-hot-toast';

export default function Login() {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveSlug = (routeSlug || searchParams.get('clinic') || searchParams.get('slug') || '').trim();

  // Use the high-performance Clinic Settings Service Layer
  const { clinicProfile: clinicInfo, loading: clinicLoading } = useClinicSettings(effectiveSlug);
  useAdminManifestBinding(effectiveSlug || null, clinicInfo?.clinicName || null);
  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Kiểm tra phòng khám đã bật tùy chọn đăng nhập Gmail & đã khai báo Gmail trong Cài đặt chưa
  const [googleStatus, setGoogleStatus] = useState<{
    loading: boolean;
    clinicFound: boolean;
    googleLoginEnabled: boolean;
    hasDeclaredEmails: boolean;
    declaredCount: number;
    isReady: boolean;
  }>({
    loading: true,
    clinicFound: true,
    googleLoginEnabled: false,
    hasDeclaredEmails: false,
    declaredCount: 0,
    isReady: false,
  });

  const fetchGoogleLoginStatus = async () => {
    setGoogleStatus(prev => ({ ...prev, loading: true }));
    try {
      const res = await api.get('/auth/google-login-status', {
        params: effectiveSlug ? { clinicSlug: effectiveSlug } : undefined,
      });
      const d = res.data?.data || {};
      setGoogleStatus({
        loading: false,
        clinicFound: d.clinicFound !== false,
        googleLoginEnabled: Boolean(d.googleLoginEnabled),
        hasDeclaredEmails: Boolean(d.hasDeclaredEmails),
        declaredCount: Number(d.declaredCount || 0),
        isReady: Boolean(d.isReady),
      });
    } catch {
      // Fail-closed: khóa đăng nhập Google nếu không xác minh được cấu hình từ Cài đặt
      setGoogleStatus({
        loading: false,
        clinicFound: true,
        googleLoginEnabled: false,
        hasDeclaredEmails: false,
        declaredCount: 0,
        isReady: false,
      });
    }
  };

  // Suggest effectiveSlug in username field if empty
  useEffect(() => {
    if (effectiveSlug) {
      setEmail(prev => prev ? prev : effectiveSlug);
    }
  }, [effectiveSlug]);

  // Modal hiển thị khi tài khoản Google không thuộc Admin Whitelist hoặc bị access_denied
  const [unauthorizedModalData, setUnauthorizedModalData] = useState<UnauthorizedModalData>({
    isOpen: false,
    email: '',
    reason: '',
    details: '',
  });

  const [isOriginHelpOpen, setIsOriginHelpOpen] = useState(false);

  const connectGoogle = useGoogleAuthStore(state => state.connect);
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  React.useEffect(() => {
    const lastEmail = localStorage.getItem('lastEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const wasRemembered = localStorage.getItem('rememberMeChecked') === 'true';

    if (lastEmail && !effectiveSlug) setEmail(lastEmail);
    if (wasRemembered && savedPassword) {
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, [effectiveSlug]);

  // Tự động gửi request ping đánh thức máy chủ và kiểm tra cấu hình đăng nhập Gmail của phòng khám
  useEffect(() => {
    fetch('/api/health').catch(() => {});
    fetchGoogleLoginStatus();
  }, [effectiveSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Auto-retry helper for cold start (503 / network transient)
    let attempts = 0;
    const maxAttempts = 3;

    const executeLogin = async (): Promise<boolean> => {
      try {
        const res = await api.post('/auth/login', { 
          email, 
          password,
          clinicSlug: effectiveSlug || undefined 
        });
        if (res.data.success) {
          setAuth(res.data.data.token, res.data.data.user);
          localStorage.setItem('lastEmail', email);
          if (res.data.data.user?.slug || effectiveSlug) {
            localStorage.setItem('last_clinic_slug', res.data.data.user?.slug || effectiveSlug);
          }
          if (rememberMe) {
            localStorage.setItem('rememberedPassword', password);
            localStorage.setItem('rememberMeChecked', 'true');
          } else {
            localStorage.removeItem('rememberedPassword');
            localStorage.removeItem('rememberMeChecked');
          }
          navigate('/admin/dashboard');
          return true;
        }
        return false;
      } catch (err: any) {
        const status = err.response?.status;
        
        if (status === 503 || !err.response) {
          setError('Máy chủ đang thức giấc từ chế độ ngủ đông (Render Cold Start). Vui lòng đợi khoảng 15-20 giây rồi bấm Đăng nhập lại.');
        } else if (status === 429) {
          setError('Hệ thống phát hiện nhiều thao tác liên tiếp (429). Vui lòng đợi khoảng 30 giây rồi bấm Đăng nhập lại.');
        } else {
          setError(err.response?.data?.error?.message || err.response?.data?.message || 'Tài khoản hoặc mật khẩu không chính xác');
        }
        return false;
      }
    };

    try {
      await executeLogin();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Đăng nhập qua tài khoản Google kèm ghi log chi tiết cho các ca 'access_denied'
   * và mở popup thân thiện giải thích về Admin Whitelist nếu email chưa được cấp phép.
   */
  const handleGoogleSignIn = async (promptMode: 'consent' | 'select_account' = 'select_account') => {
    if (!googleStatus.isReady) {
      setError(
        !googleStatus.clinicFound
          ? `Không tìm thấy phòng khám "${effectiveSlug}" trong hệ thống.`
          : !googleStatus.googleLoginEnabled
          ? 'Phòng khám chưa bật tùy chọn đăng nhập bằng Gmail trong mục Cài đặt. Vui lòng đăng nhập bằng Tên đăng nhập & Mật khẩu.'
          : 'Phòng khám chưa khai báo Gmail quản trị nào trong mục Cài đặt. Hệ thống tạm khóa đăng nhập Google để bảo mật.'
      );
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      console.log('[Login] Đang kích hoạt Google OAuth sign-in...', { promptMode, clinicSlug: effectiveSlug || 'root', timestamp: new Date().toISOString() });
      const googleResult = await connectGoogle({ prompt: promptMode });

      if (!googleResult?.accessToken) {
        throw new Error('Không nhận được Access Token từ tài khoản Google.');
      }

      const googleEmail = googleResult.user?.email || '';
      console.log('[Login] Google OAuth thành công. Đang đối soát với Cài đặt phòng khám cho email:', googleEmail);

      // Gửi token và clinicSlug lên máy chủ để xác thực Google userinfo và đối soát với Gmail đã khai báo trong Cài đặt
      try {
        const res = await api.post('/auth/google', {
          accessToken: googleResult.accessToken,
          clinicSlug: effectiveSlug || undefined,
        });

        if (res.data?.success && res.data?.data?.token) {
          console.log('[Login] Đăng nhập Google được phê duyệt thành công:', res.data.data.user);
          setAuth(res.data.data.token, res.data.data.user);
          if (googleEmail) localStorage.setItem('lastEmail', googleEmail);
          if (res.data.data.user?.slug || effectiveSlug) {
            localStorage.setItem('last_clinic_slug', res.data.data.user?.slug || effectiveSlug);
          }
          navigate('/admin/dashboard');
        } else {
          throw new Error('Phản hồi từ máy chủ không hợp lệ.');
        }
      } catch (serverErr: any) {
        const errResponse = serverErr.response?.data;
        const statusCode = serverErr.response?.status;
        const errCode = errResponse?.error?.code;

        if (errCode === 'GOOGLE_LOGIN_DISABLED' || errCode === 'NO_DECLARED_GMAIL' || errCode === 'CLINIC_NOT_FOUND') {
          await fetchGoogleLoginStatus();
          setError(errResponse?.error?.message || 'Chức năng đăng nhập bằng Gmail chưa được cấu hình trong mục Cài đặt.');
          return;
        }

        // Bắt lỗi 403 UNAUTHORIZED_EMAIL khi Gmail không nằm trong danh sách đã khai báo trong Cài đặt
        if (statusCode === 403 || errCode === 'UNAUTHORIZED_EMAIL' || errResponse?.data?.errorCode === 'access_denied') {
          console.error('[Login][ACCESS_DENIED] Tài khoản Google bị từ chối truy cập (Chưa được khai báo trong Cài đặt):', {
            error: 'access_denied',
            errorCode: errCode || 'UNAUTHORIZED_EMAIL',
            attemptedEmail: googleEmail || errResponse?.data?.email,
            clinicSlug: effectiveSlug || 'root',
            statusCode,
            serverMessage: errResponse?.error?.message,
            timestamp: new Date().toISOString(),
          });

          setUnauthorizedModalData({
            isOpen: true,
            email: googleEmail || errResponse?.data?.email || '',
            reason: errCode || 'UNAUTHORIZED_EMAIL',
            details: errResponse?.error?.message || 'Gmail này chưa được khai báo trong mục Cài đặt của phòng khám.',
            timestamp: new Date().toLocaleString('vi-VN')
          });
          return;
        }

        throw serverErr;
      }
    } catch (authErr: any) {
      // Người dùng tự đóng popup
      if (authErr?.isCancelled || authErr?.code === 'auth/popup-closed-by-user') {
        console.info('[Login] Cửa sổ Google sign-in đã được đóng bởi người dùng.');
        return;
      }

      // Nhận diện lỗi access_denied trực tiếp từ Google OAuth
      const isAccessDenied = 
        authErr?.isAccessDenied ||
        authErr?.code === 'auth/access-denied' ||
        (typeof authErr?.message === 'string' && (
          authErr.message.toLowerCase().includes('access_denied') ||
          authErr.message.toLowerCase().includes('access-denied') ||
          authErr.message.toLowerCase().includes('bị từ chối')
        ));

      if (isAccessDenied) {
        console.error('[Login][ACCESS_DENIED] Google OAuth trả về lỗi access_denied trong quá trình đăng nhập:', {
          error: 'access_denied',
          errorCode: authErr?.code || 'auth/access-denied',
          errorMessage: authErr?.message,
          rawDetails: authErr?.rawDetails,
          email: authErr?.email || '',
          timestamp: new Date().toISOString(),
          solution: 'Email chưa được đăng ký trong danh sách Test Users (Google Cloud Console) hoặc Admin Whitelist.'
        });

        setUnauthorizedModalData({
          isOpen: true,
          email: authErr?.email || '',
          reason: 'access_denied',
          details: authErr?.message || 'Truy cập bị từ chối bởi Google OAuth (mã lỗi: access_denied).',
          timestamp: new Date().toLocaleString('vi-VN')
        });
        return;
      }

      // Nhận diện lỗi origin_mismatch (Lỗi 400 Google OAuth khi chưa whitelist tên miền)
      const isOriginMismatch = 
        authErr?.code === 'origin_mismatch' ||
        authErr?.code === 'idpiframe_initialization_failed' ||
        (typeof authErr?.message === 'string' && (
          authErr.message.toLowerCase().includes('origin_mismatch') ||
          authErr.message.toLowerCase().includes('origin') ||
          authErr.message.toLowerCase().includes('400')
        ));

      if (isOriginMismatch) {
        setIsOriginHelpOpen(true);
        setError('Google báo lỗi "origin_mismatch" (400) do tên miền này chưa được thêm vào "Authorized JavaScript origins" trên Google Cloud Console. Nhấn vào hướng dẫn bên dưới để xem cách khắc phục.');
        return;
      }

      console.error('[Login] Lỗi khi xử lý đăng nhập Google:', authErr);
      setError(authErr.response?.data?.error?.message || authErr.message || 'Đăng nhập bằng Google thất bại');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-4 relative">
      <Link 
        to={effectiveSlug ? `/b/${effectiveSlug}?mode=customer` : "/book"} 
        className="absolute top-6 left-6 flex items-center text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-2xl shadow-sm border border-slate-200 transition-all hover:bg-slate-50"
      >
        <ArrowLeft className="w-4 h-4 mr-2 text-teal-600" />
        <span>{effectiveSlug && clinicInfo?.clinicName ? `Quay lại đặt lịch ${clinicInfo.clinicName}` : 'Quay lại trang đặt lịch'}</span>
      </Link>

      <Card className="w-full max-w-md shadow-xl border border-slate-200/80 rounded-3xl">
        <CardHeader className="text-center pt-8 pb-4">
          {effectiveSlug ? (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-md mb-2.5">
                {clinicInfo?.clinicName ? clinicInfo.clinicName.charAt(0).toUpperCase() : effectiveSlug.charAt(0).toUpperCase()}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 mb-2">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Cổng Quản Trị Phòng Khám</span>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 text-center leading-snug">
                {clinicInfo?.clinicName || `Phòng khám ${effectiveSlug}`}
              </CardTitle>
              {clinicInfo?.doctorName && (
                <p className="text-xs text-teal-700 font-semibold mt-1">
                  Bác sĩ phụ trách: {clinicInfo.doctorName}
                </p>
              )}
              {clinicInfo?.address && (
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {clinicInfo.address}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Quản lý lịch hẹn, hồ sơ bệnh nhân &amp; cấu hình phòng khám
              </p>
            </div>
          ) : (
            <>
              <CardTitle className="text-2xl font-bold text-slate-800">Đăng nhập hệ thống</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Cổng quản trị nha khoa &amp; đồng bộ dữ liệu khám</p>
            </>
          )}
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-status-cancelled bg-status-cancelled-bg p-3 rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            {/* Khu vực Đăng nhập bằng Google - Kiểm tra cấu hình từ Cài đặt */}
            {googleStatus.loading ? (
              <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 text-slate-500 font-medium rounded-2xl border border-slate-200 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>Đang kiểm tra cấu hình đăng nhập Gmail...</span>
              </div>
            ) : googleStatus.isReady ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('select_account')}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl border border-slate-300/90 shadow-2xs hover:shadow-xs transition-all disabled:opacity-60 cursor-pointer text-sm active:scale-[0.99]"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Đang kết nối &amp; đối soát Gmail...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Đăng nhập bằng Google</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Chỉ chấp nhận Gmail đã khai báo trong Cài đặt phòng khám</span>
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsOriginHelpOpen(true)}
                    className="text-[11px] text-slate-500 hover:text-teal-700 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>❓ Hướng dẫn kết nối Google OAuth (Khắc phục lỗi 400 nếu có)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-bold text-amber-900">
                      {!googleStatus.clinicFound
                        ? 'Không tìm thấy phòng khám'
                        : !googleStatus.googleLoginEnabled
                        ? 'Đăng nhập bằng Gmail đang TẮT'
                        : 'Chưa khai báo Gmail quản trị trong Cài đặt'}
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {!googleStatus.clinicFound
                        ? `Mã phòng khám "${effectiveSlug}" chưa tồn tại.`
                        : !googleStatus.googleLoginEnabled
                        ? 'Để ngăn người lạ đăng nhập trái phép bằng Gmail cá nhân, cổng đăng nhập Google chỉ mở khi quản trị viên bật tùy chọn và khai báo Gmail trong mục Cài đặt > Bảo mật Đăng nhập bằng Gmail.'
                        : 'Phòng khám chưa khai báo địa chỉ Gmail được phép đăng nhập trong mục Cài đặt. Vui lòng dùng Tài khoản & Mật khẩu bên dưới.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={fetchGoogleLoginStatus}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Kiểm tra lại trạng thái Cài đặt</span>
                  </button>
                </div>
              </div>
            )}

            {/* Đường phân cách hoặc */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider text-[10px]">
                  Hoặc đăng nhập mật khẩu
                </span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tên đăng nhập hoặc Email</label>
                <Input 
                  type="text" 
                  placeholder={effectiveSlug ? `VD: ${effectiveSlug} hoặc email phòng khám` : "VD: admin hoặc admin@dentalsmartbooking.com"} 
                  value={email || ''} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  autoComplete="username"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Mật khẩu</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={password || ''} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    autoComplete="current-password"
                    className="pr-10 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 pb-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs text-slate-600 cursor-pointer select-none">
                  Ghi nhớ tài khoản và mật khẩu
                </label>
              </div>
              <Button type="submit" className="w-full py-2.5 rounded-xl font-semibold text-sm" disabled={loading || googleLoading}>
                {loading ? 'Đang xử lý...' : (effectiveSlug && clinicInfo?.clinicName ? `Đăng nhập ${clinicInfo.clinicName}` : 'Đăng nhập')}
              </Button>
            </form>

            {!isInstalled && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    localStorage.setItem('pwa_admin_mode', '1');
                    if (effectiveSlug) localStorage.setItem('last_admin_slug', effectiveSlug);
                    if (isInstallable) {
                      const ok = await install();
                      if (ok) {
                        toast.success('Đã cài App Quản Lý ra Màn hình chính!');
                        return;
                      }
                    }
                    setShowInstallModal(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Cài trang Quản Lý ra Màn hình chính điện thoại</span>
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showInstallModal && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Cài App Quản Lý Phòng Khám</h3>
                  <p className="text-xs text-slate-500">Mở nhanh và nhận thông báo đặt lịch trên điện thoại</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
                <li>Mở trang này bằng trình duyệt <strong>Safari</strong>.</li>
                <li>Nhấn biểu tượng <strong>Chia sẻ</strong> <Share className="w-3.5 h-3.5 inline text-blue-600 mx-0.5" /> ở thanh dưới cùng.</li>
                <li>Chọn <PlusSquare className="w-3.5 h-3.5 inline mx-0.5" /> <strong>&ldquo;Thêm vào MH chính&rdquo;</strong> ➔ bấm <strong>Thêm</strong>.</li>
              </ol>
            ) : (
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
                <li>Bấm menu <strong>3 chấm (⋮)</strong> ở góc trên bên phải Chrome / trình duyệt.</li>
                <li>Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong>.</li>
                <li>Đăng nhập xong, chạm biểu tượng chuông 🔔 trên đầu để bật thông báo đẩy.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Modal thân thiện giải thích Admin Whitelist khi email chưa được uỷ quyền hoặc access_denied */}
      <UnauthorizedEmailModal
        data={unauthorizedModalData}
        onClose={() => setUnauthorizedModalData(prev => ({ ...prev, isOpen: false }))}
        onRetryWithDifferentAccount={() => handleGoogleSignIn('select_account')}
      />

      {/* Modal hướng dẫn chi tiết cách sửa Lỗi 400 origin_mismatch từ Google */}
      <GoogleOriginHelpModal
        isOpen={isOriginHelpOpen}
        onClose={() => setIsOriginHelpOpen(false)}
      />
    </div>
  );
}

