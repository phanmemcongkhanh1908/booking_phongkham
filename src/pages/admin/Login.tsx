import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

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
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-4 relative">
      <Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center text-sm font-medium text-text-muted hover:text-text-main bg-surface px-4 py-2 rounded-full shadow-soft border border-border-subtle transition-all hover:shadow"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại trang khách hàng
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Đăng nhập hệ thống</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && <div className="text-sm text-status-cancelled bg-status-cancelled-bg p-2 rounded">{error}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Tên đăng nhập hoặc Email</label>
              <Input 
                type="text" 
                placeholder="VD: admin hoặc admin@dentalsmartbooking.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Mật khẩu</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main focus:outline-none transition-colors"
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
                className="rounded border-slate-300 text-primary focus:ring-teal-600 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-text-muted cursor-pointer select-none">
                Ghi nhớ tài khoản và mật khẩu
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
