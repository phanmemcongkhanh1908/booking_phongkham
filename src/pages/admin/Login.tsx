import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import UnauthorizedEmailModal, { UnauthorizedModalData } from './components/UnauthorizedEmailModal';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Modal hiển thị khi tài khoản Google không thuộc Admin Whitelist hoặc bị access_denied
  const [unauthorizedModalData, setUnauthorizedModalData] = useState<UnauthorizedModalData>({
    isOpen: false,
    email: '',
    reason: '',
    details: '',
  });

  const connectGoogle = useGoogleAuthStore(state => state.connect);
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  React.useEffect(() => {
    const lastEmail = localStorage.getItem('lastEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const wasRemembered = localStorage.getItem('rememberMeChecked') === 'true';

    if (lastEmail) setEmail(lastEmail);
    if (wasRemembered && savedPassword) {
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        setAuth(res.data.data.token, res.data.data.user);
        localStorage.setItem('lastEmail', email);
        if (rememberMe) {
          localStorage.setItem('rememberedPassword', password);
          localStorage.setItem('rememberMeChecked', 'true');
        } else {
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberMeChecked');
        }
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Đăng nhập qua tài khoản Google kèm ghi log chi tiết cho các ca 'access_denied'
   * và mở popup thân thiện giải thích về Admin Whitelist nếu email chưa được cấp phép.
   */
  const handleGoogleSignIn = async (promptMode: 'consent' | 'select_account' = 'select_account') => {
    setGoogleLoading(true);
    setError('');

    try {
      console.log('[Login] Đang kích hoạt Google OAuth sign-in...', { promptMode, timestamp: new Date().toISOString() });
      const googleResult = await connectGoogle({ prompt: promptMode });

      if (!googleResult?.accessToken) {
        throw new Error('Không nhận được Access Token từ tài khoản Google.');
      }

      const googleEmail = googleResult.user?.email || '';
      console.log('[Login] Google OAuth thành công. Đang đối soát với Admin Whitelist cho email:', googleEmail);

      // Gửi token và email lên máy chủ để đối soát với bảng users và Admin Whitelist
      try {
        const res = await api.post('/auth/google', {
          accessToken: googleResult.accessToken,
          email: googleEmail,
        });

        if (res.data?.success && res.data?.data?.token) {
          console.log('[Login] Đăng nhập Google được phê duyệt thành công:', res.data.data.user);
          setAuth(res.data.data.token, res.data.data.user);
          if (googleEmail) localStorage.setItem('lastEmail', googleEmail);
          navigate('/admin/dashboard');
        } else {
          throw new Error('Phản hồi từ máy chủ không hợp lệ.');
        }
      } catch (serverErr: any) {
        const errResponse = serverErr.response?.data;
        const statusCode = serverErr.response?.status;

        // Bắt lỗi 403 UNAUTHORIZED_EMAIL từ Admin Whitelist
        if (statusCode === 403 || errResponse?.error?.code === 'UNAUTHORIZED_EMAIL' || errResponse?.data?.errorCode === 'access_denied') {
          console.error('[Login][ACCESS_DENIED] Tài khoản Google bị từ chối truy cập (Chưa thuộc Admin Whitelist):', {
            error: 'access_denied',
            errorCode: errResponse?.error?.code || 'UNAUTHORIZED_EMAIL',
            attemptedEmail: googleEmail || errResponse?.data?.email,
            statusCode,
            serverMessage: errResponse?.error?.message,
            timestamp: new Date().toISOString(),
            solution: 'Quản trị viên cần thêm email này vào danh sách Admin Whitelist (Gmail phòng khám) trong Quản lý tài khoản.'
          });

          setUnauthorizedModalData({
            isOpen: true,
            email: googleEmail || errResponse?.data?.email || '',
            reason: 'access_denied',
            details: errResponse?.error?.message || 'Email này chưa được cấp phép trong danh sách Admin Whitelist của phòng khám.',
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

      console.error('[Login] Lỗi khi xử lý đăng nhập Google:', authErr);
      setError(authErr.response?.data?.error?.message || authErr.message || 'Đăng nhập bằng Google thất bại');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-4 relative">
      <Link 
        to={localStorage.getItem('last_clinic_slug') ? `/booking/${localStorage.getItem('last_clinic_slug')}` : "/"} 
        className="absolute top-6 left-6 flex items-center text-sm font-medium text-text-muted hover:text-text-main bg-surface px-4 py-2 rounded-full shadow-soft border border-border-subtle transition-all hover:shadow"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại trang khách hàng
      </Link>

      <Card className="w-full max-w-md shadow-xl border border-slate-200/80 rounded-3xl">
        <CardHeader className="text-center pt-8 pb-4">
          <CardTitle className="text-2xl font-bold text-slate-800">Đăng nhập hệ thống</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Cổng quản trị nha khoa &amp; đồng bộ dữ liệu khám</p>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-status-cancelled bg-status-cancelled-bg p-3 rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            {/* Nút Đăng nhập bằng Google */}
            <button
              type="button"
              onClick={() => handleGoogleSignIn('select_account')}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl border border-slate-300/90 shadow-2xs hover:shadow-xs transition-all disabled:opacity-60 cursor-pointer text-sm active:scale-[0.99]"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Đang kết nối Google...</span>
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
                  placeholder="VD: admin hoặc admin@dentalsmartbooking.com" 
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
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Modal thân thiện giải thích Admin Whitelist khi email chưa được uỷ quyền hoặc access_denied */}
      <UnauthorizedEmailModal
        data={unauthorizedModalData}
        onClose={() => setUnauthorizedModalData(prev => ({ ...prev, isOpen: false }))}
        onRetryWithDifferentAccount={() => handleGoogleSignIn('select_account')}
      />
    </div>
  );
}

