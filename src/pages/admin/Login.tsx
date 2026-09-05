import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('admin@dentalsmartbooking.com');
  const [password, setPassword] = useState('admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
              <label className="text-sm font-medium text-text-main">Email</label>
              <Input type="email" placeholder="admin@dentalsmartbooking.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Mật khẩu</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
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
