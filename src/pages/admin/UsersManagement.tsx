import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';
import {  
  Users, ShieldCheck, Key, Lock, Unlock, X, Edit, 
  Plus, CheckCircle2, AlertTriangle, RefreshCw, Loader2,
  Eye, EyeOff, Download, Link as LinkIcon, Copy, Check, ExternalLink, Sparkles,
  Building2, Globe, Zap, Shield
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
  error?: string;
}

const PERMISSION_MATRIX = [
  {
    module: 'Quản trị hệ thống (Root)',
    permissions: [
      { id: '*', label: 'Toàn quyền (Super Admin)' },
    ]
  },
  {
    module: 'Lễ tân & CSKH',
    permissions: [
      { id: 'appointment.view', label: 'Xem lịch hẹn' },
      { id: 'appointment.create', label: 'Thêm/Sửa lịch' },
      { id: 'appointment.update', label: 'Xóa lịch hẹn' },
      { id: 'patient.view', label: 'Xem/Thêm hồ sơ bệnh nhân' },
    ]
  },
  {
    module: 'Bác sĩ & Lâm sàng',
    permissions: [
      { id: 'clinical.view', label: 'Xem hồ sơ bệnh án' },
      { id: 'clinical.edit', label: 'Chỉnh sửa/Cập nhật bệnh án' },
      { id: 'xray.view', label: 'Xem phim X-Quang' },
    ]
  },
  {
    module: 'Quản lý phòng khám',
    permissions: [
      { id: 'service.manage', label: 'Quản lý dịch vụ' },
      { id: 'analytics.view', label: 'Xem báo cáo doanh thu' },
      { id: 'user.create', label: 'Quản lý nhân sự' },
      { id: 'setting.manage', label: 'Cấu hình hệ thống' },
    ]
  }
];


export default function UsersManagement() {
  const { user } = useAuthStore(state => state);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['*']);
  const [uiMode, setUiMode] = useState<'full' | 'simple'>('full');
  const [slug, setSlug] = useState('');
  const [linkOptions, setLinkOptions] = useState<ShortLinkOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('internal');
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const triggerShorten = async (targetSlug: string) => {
    const cleanSlug = (targetSlug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug) {
      setLinkOptions([]);
      return;
    }

    const currentOrigin = window.location.origin;
    const directInternal = `${currentOrigin}/b/${cleanSlug}`;
    const fullLink = `${currentOrigin}/booking/${cleanSlug}`;

    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
    const initialOptions: ShortLinkOption[] = [
      {
        id: 'internal',
        name: 'Link phòng khám (Khuyên dùng)',
        tagline: 'Tên miền chính chủ • 100% Không quảng cáo • Nhận diện thương hiệu',
        url: directInternal,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      },
      {
        id: 'full',
        name: 'Đường dẫn chuẩn (Gốc)',
        tagline: 'Link đầy đủ chuẩn SEO • Phù hợp đăng Website / Fanpage',
        url: fullLink,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'full',
      }
    ];
    setLinkOptions(initialOptions);

    setIsGeneratingShortUrl(true);
    try {
      const res = await api.post('/public/shorten', {
        url: fullLink,
        slug: cleanSlug,
        origin: currentOrigin,
      });

      if (res.data?.data?.options && Array.isArray(res.data.data.options)) {
        setLinkOptions(res.data.data.options);
      }
    } catch (err) {
      console.warn("Short link server fallback to local clean options:", err);
    } finally {
      setIsGeneratingShortUrl(false);
    }
  };

  useEffect(() => {
    if (!slug) {
      setLinkOptions([]);
      return;
    }

    const timer = setTimeout(() => {
      triggerShorten(slug);
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  const activeLinkItem = linkOptions.find(opt => opt.id === selectedOptionId) || linkOptions[0] || {
    id: 'internal',
    name: 'Link phòng khám (Khuyên dùng)',
    tagline: 'Tên miền chính chủ • 100% Không quảng cáo',
    url: slug ? `${window.location.origin}/b/${slug}` : '',
    isAdFree: true,
    isDirectRedirect: true,
    type: 'brand',
  };
  const currentActiveUrl = activeLinkItem?.url || (slug ? `${window.location.origin}/b/${slug}` : '');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.data) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUserId(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedPermissions(['*']);
    setUiMode('full');
    setSlug('');
    setLinkOptions([]);
    setSelectedOptionId('internal');
    setCopied(false);
    setMsg('');
    setIsError(false);
    setShowModal(true);
  };

  const openEditModal = (u: any) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setEmail(u.email || '');
    setPassword('');
    
    const hasAll = u.permissions?.includes('*') || u.rolePermissions?.includes('*') || u.roleName === 'admin';
    setSelectedPermissions(hasAll ? ['*'] : (u.permissions || []));
    setUiMode(u.uiMode || 'full');
    const userSlug = u.slug || '';
    setSlug(userSlug);
    setSelectedOptionId('internal');
    setCopied(false);
    
    setMsg('');
    setIsError(false);
    setShowModal(true);
  };

  const handleCopyLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const canvas = document.getElementById('qr-code-canvas');
    if (canvas) {
      const svgData = new XMLSerializer().serializeToString(canvas);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${slug || 'booking'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadStandeePng = () => {
    const svg = document.getElementById('qr-code-canvas');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 640;
      canvas.height = 760;
      if (ctx) {
        // Nền trắng tinh khiết
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 640, 760);

        // Viền khung ngoài thanh lịch
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.strokeRect(16, 16, 608, 728);

        // Banner tiêu đề trên cùng
        ctx.fillStyle = '#0D9488';
        ctx.fillRect(16, 16, 608, 116);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ĐẶT LỊCH HẸN TRỰC TUYẾN', 320, 64);

        ctx.fillStyle = '#CCFBF1';
        ctx.font = '15px sans-serif';
        ctx.fillText('Quét mã QR bằng Camera điện thoại hoặc ứng dụng Zalo', 320, 98);

        // Mã QR Code vẽ chính giữa
        ctx.drawImage(img, 145, 145, 350, 350);

        // Khung hiển thị đường dẫn rút gọn
        ctx.fillStyle = '#F0FDFA';
        ctx.fillRect(40, 520, 560, 68);
        ctx.strokeStyle = '#99F6E4';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(40, 520, 560, 68);

        const activeTarget = currentActiveUrl || `${window.location.origin}/b/${slug || 'booking'}`;

        ctx.fillStyle = '#0F766E';
        ctx.font = activeTarget.length > 40 ? 'bold 14px monospace' : 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(activeTarget, 320, 562);

        ctx.fillStyle = '#334155';
        ctx.font = '500 15px sans-serif';
        ctx.fillText('Chủ động chọn bác sĩ • Không phải xếp hàng chờ đợi', 320, 634);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px sans-serif';
        ctx.fillText('Dental Smart Booking • Hệ Thống Y Tế & Nha Khoa Thông Minh', 320, 672);

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `standee-qr-${slug || 'booking'}.png`;
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'create' && password !== confirmPassword) {
      setIsError(true); setMsg('Mật khẩu xác nhận không khớp!');
      return;
    }
    if (modalMode === 'edit' && password && password !== confirmPassword) {
      setIsError(true); setMsg('Mật khẩu xác nhận không khớp!');
      return;
    }
    setIsSubmitting(true);
    setMsg('');
    setIsError(false);
    
    try {
      if (modalMode === 'create') {
        const trimmedIdentifier = email.trim();
        await api.post('/users', { 
          username: trimmedIdentifier,
          email: trimmedIdentifier,
          password,
          permissions: selectedPermissions,
          uiMode,
          slug
        });
        setMsg(`Tạo tài khoản '${trimmedIdentifier}' thành công!`);
      } else {
        const updateData: any = { permissions: selectedPermissions, uiMode, slug };
        if (password) {
          updateData.password = password.trim();
        }
        await api.put(`/users/${editingUserId}`, updateData);
        setMsg('Cập nhật tài khoản thành công!');
      }
      setIsError(false);
      fetchUsers();
      
      if (modalMode === 'create') {
        setEmail('');
        setPassword('');
        setSelectedPermissions(['*']);
      }
    } catch (err: any) {
      setIsError(true);
      setMsg(err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockUser = async (userId: string, currentStatus: boolean) => {
    const actionText = currentStatus ? 'khoá' : 'mở khoá';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản này?`)) return;
    try {
      await api.put(`/users/${userId}`, { isActive: !currentStatus });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Có lỗi xảy ra khi ${actionText} tài khoản`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này? Hành động này không thể hoàn tác!')) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Có lỗi xảy ra khi xóa tài khoản');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Danh sách tài khoản</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý nhân sự và phân quyền truy cập hệ thống.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm tài khoản
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-y border-slate-200">
              <tr>
                <th className="px-4 py-3">Tài khoản / Email</th>
                <th className="px-4 py-3">Quyền hạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, idx) => {
                const isSuperAdmin = u.email === 'admin@dentalsmartbooking.com';
                const hasAll = u.permissions?.includes('*') || u.rolePermissions?.includes('*') || u.roleName === 'admin';
                return (
                  <tr key={u.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 border-b border-slate-100">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${u.isActive === false ? 'text-slate-400 line-through' : 'text-slate-800'} ${isSuperAdmin ? 'text-teal-700' : ''}`}>
                            {u.email}
                          </span>
                          {isSuperAdmin && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                              Admin Tối Cao
                            </span>
                          )}
                          {u.tenantId && !user?.tenantId && !isSuperAdmin && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              Tenant
                            </span>
                          )}
                        </div>
                        {isSuperAdmin && (
                          <span className="text-[11px] text-amber-600/80 italic mt-0.5">
                            Quản lý cấp cao nhất
                          </span>
                        )}
                        {u.slug && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                              <LinkIcon className="w-3 h-3 text-teal-600 shrink-0" />
                              /b/{u.slug}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(`${window.location.origin}/b/${u.slug}`)}
                              className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                              title="Sao chép link đặt hẹn"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`${window.location.origin}/b/${u.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                              title="Mở trang đặt hẹn phòng khám"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 border-b border-slate-100">
                      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${u.isActive === false ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-700'}`}>
                        {hasAll ? 'Toàn quyền' : (u.permissions?.length ? `${u.permissions.length} quyền` : (u.roleName || 'guest'))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${u.isActive === false ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                        <span className={u.isActive === false ? 'text-slate-400' : 'text-slate-700'}>
                          {u.isActive === false ? 'Đã khóa' : 'Hoạt động'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 border-b border-slate-100 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa & Phân quyền"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {!isSuperAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleLockUser(u.id, u.isActive !== false)}
                              className={`p-1.5 rounded-lg transition-colors ${u.isActive === false ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                              title={u.isActive === false ? "Mở khoá tài khoản" : "Khoá tài khoản"}
                            >
                              {u.isActive === false ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Xóa tài khoản"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    Chưa có tài khoản nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {modalMode === 'create' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân quyền quản trị và cấu hình đường dẫn đặt lịch trực tuyến cho phòng khám.
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 grow">
              <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
                {msg && (
                  <div className={`text-sm p-4 rounded-xl border flex items-center gap-3 ${
                    isError 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isError ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    <span className="font-medium">{msg}</span>
                  </div>
                )}
                
                {/* PHẦN 1: THÔNG TIN ĐĂNG NHẬP & PHÂN QUYỀN (2 CỘT CÂN ĐỐI) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cột 1: Thông tin tài khoản & Giao diện */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-600" />
                      Thông tin tài khoản & Giao diện
                    </h4>
                    
                    <div className="space-y-3.5 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200/80">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">Tên tài khoản / Email</label>
                        <input 
                          type="text" 
                          placeholder="VD: admin hoặc admin@phongkham.vn" 
                          value={email || ''} 
                          onChange={e => setEmail(e.target.value)} 
                          required={modalMode === 'create'}
                          disabled={modalMode === 'edit'}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                          {modalMode === 'edit' ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
                        </label>
                        <div className="relative">
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="Tối thiểu 6 ký tự" 
                            value={password || ''} 
                            onChange={e => setPassword(e.target.value)} 
                            required={modalMode === 'create'}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                          Xác nhận mật khẩu
                        </label>
                        <div className="relative">
                          <input 
                            type={showConfirmPassword ? 'text' : 'password'} 
                            placeholder="Nhập lại mật khẩu" 
                            value={confirmPassword || ''} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            required={modalMode === 'create' || (modalMode === 'edit' && password.length > 0)}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
                          Giao diện hiển thị
                        </label>
                        <select
                          value={uiMode || 'full'}
                          onChange={(e) => setUiMode(e.target.value as 'full' | 'simple')}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-teal-600/10 focus:border-teal-600 transition-all"
                        >
                          <option value="full">Đầy đủ (Dành cho Quản trị viên & Bác sĩ)</option>
                          <option value="simple">Đơn giản (Dành cho Lễ tân & Trợ thủ)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Phân quyền chức năng */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Key className="w-4 h-4 text-teal-600" />
                      Phân quyền chức năng
                    </h4>
                    
                    <div className="border border-slate-200 rounded-2xl bg-slate-50/50 p-4 h-[320px] overflow-y-auto divide-y divide-slate-200/70 shadow-inner">
                      {PERMISSION_MATRIX.map(module => (
                        <div key={module.module} className="py-3 first:pt-0 last:pb-0 space-y-2.5">
                          <h5 className="text-xs font-bold uppercase tracking-wide text-slate-800">{module.module}</h5>
                          <div className="flex flex-col gap-2">
                            {module.permissions.map(p => (
                              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="peer appearance-none w-4.5 h-4.5 border-2 border-slate-300 rounded-md checked:border-teal-600 checked:bg-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    checked={selectedPermissions.includes('*') || selectedPermissions.includes(p.id)}
                                    disabled={p.id !== '*' && selectedPermissions.includes('*')}
                                    onChange={(e) => {
                                      if (p.id === '*') {
                                        setSelectedPermissions(e.target.checked ? ['*'] : []);
                                      } else {
                                        setSelectedPermissions(prev => 
                                          e.target.checked 
                                            ? [...prev.filter(id => id !== '*'), p.id] 
                                            : prev.filter(id => id !== p.id)
                                        );
                                      }
                                    }}
                                  />
                                  <CheckCircle2 className="w-3 h-3 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                                </div>
                                <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900 transition-colors select-none">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PHẦN 2: CẤU HÌNH PHÒNG KHÁM, ĐƯỜNG DẪN & QR STANDEE (FULL WIDTH) */}
                <div className="pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-teal-600" />
                        Cấu hình Phòng khám & Đường dẫn Đặt Lịch (QR Standee)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Thiết lập định danh riêng (Slug), hệ thống tự động sinh mã QR và các đường dẫn rút gọn 100% không quảng cáo.
                      </p>
                    </div>
                  </div>
                  
                  {/* Ô nhập Slug */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600 block">
                      Đường dẫn định danh phòng khám (Slug)
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10 transition-all shadow-2xs">
                      <span className="px-3.5 py-2.5 bg-slate-100 text-slate-500 font-mono text-xs border-r border-slate-200 shrink-0 font-medium select-none">
                        {window.location.origin}/booking/
                      </span>
                      <input
                        type="text"
                        value={slug || ''}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="VD: nha-khoa-le-phuong"
                        className="flex-1 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Chỉ dùng chữ cái viết thường không dấu, số và dấu gạch ngang.
                    </p>
                  </div>

                  {slug ? (
                    <div className="p-5 bg-gradient-to-br from-teal-50/50 via-white to-slate-50 border border-teal-200 rounded-2xl space-y-5 shadow-xs">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Cột Trái: QR Code Preview & Downloads */}
                        <div className="lg:col-span-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col items-center gap-3.5 text-center">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 inline-flex items-center justify-center">
                            <QRCodeSVG 
                              id="qr-code-canvas"
                              value={currentActiveUrl || `${window.location.origin}/b/${slug}`} 
                              size={130} 
                              level="M"
                              includeMargin={false}
                              fgColor="#0f172a"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <span className="inline-block text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/70">
                              Mã QR tự động cập nhật
                            </span>
                            <p className="text-[11px] text-slate-500 max-w-[200px]">
                              Quét bằng Camera điện thoại hoặc Zalo để mở trang đặt lịch.
                            </p>
                          </div>

                          <div className="w-full space-y-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={handleDownloadStandeePng}
                              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Tải Standee In Quầy (PNG)
                            </button>

                            <button
                              type="button"
                              onClick={handleDownloadSvg}
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              Tải file Vector (SVG)
                            </button>
                          </div>
                        </div>

                        {/* Cột Phải: Danh sách các tùy chọn link rút gọn không quảng cáo */}
                        <div className="lg:col-span-8 space-y-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-teal-600" />
                              <span className="text-sm font-bold text-slate-800">
                                Tùy chọn đường dẫn rút gọn (100% Không quảng cáo)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => triggerShorten(slug)}
                              disabled={isGeneratingShortUrl}
                              title="Tạo lại các link rút gọn"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors shadow-2xs"
                            >
                              <RefreshCw className={`w-3 h-3 ${isGeneratingShortUrl ? 'animate-spin text-teal-600' : ''}`} />
                              <span>{isGeneratingShortUrl ? 'Đang tạo...' : 'Tạo lại link'}</span>
                            </button>
                          </div>

                          {/* Danh sách các options */}
                          <div className="w-full">
                            {(() => {
                              const renderOption = (opt) => {
                                const isDisabled = !!opt.error;
                                const isSelected = selectedOptionId === opt.id && !isDisabled;
                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => !isDisabled && setSelectedOptionId(opt.id)}
                                    className={`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 relative overflow-hidden ${
                                      isDisabled 
                                        ? 'bg-slate-50 border-slate-200 opacity-75 cursor-not-allowed'
                                        : isSelected 
                                          ? 'bg-white border-teal-600 ring-2 ring-teal-600/10 shadow-xs cursor-pointer' 
                                          : 'bg-white/80 border-slate-200 hover:border-teal-300 hover:bg-white cursor-pointer'
                                    }`}
                                  >
                                    <div className="pt-0.5 shrink-0">
                                      <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
                                        isDisabled ? 'border-slate-300 bg-slate-100' : isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[13px] font-bold ${isDisabled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{opt.name}</span>
                                        {!isDisabled && opt.isAdFree && (
                                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                            100% Không QC
                                          </span>
                                        )}
                                        {!isDisabled && opt.type === 'brand' && (
                                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 whitespace-nowrap">
                                            Chính chủ
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 leading-snug">
                                        {opt.tagline}
                                      </p>
                                      
                                      {isDisabled ? (
                                        <div className="pt-1.5">
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {opt.error}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="pt-1 flex flex-wrap items-center gap-2">
                                          <span className="inline-block font-mono text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 break-all">
                                            {opt.url.replace(/^https?:\/\//, '')}
                                          </span>
                                          {!isSelected && (
                                            <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-teal-100 transition-opacity">
                                              <Sparkles className="w-3 h-3" />
                                              Đổi mã QR theo link này
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              };

                              const brandOptions = linkOptions.filter(o => o.type === 'brand');
                              const shortOptions = linkOptions.filter(o => o.type === 'short' || o.type === 'full');

                              return (
                                <div className="space-y-4">
                                  <div className="space-y-2.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5 ml-1">
                                      <ShieldCheck className="w-4 h-4" />
                                      Hệ thống khuyên dùng (Ổn định 100%)
                                    </div>
                                    {brandOptions.map(renderOption)}
                                  </div>
                                  
                                  {shortOptions.length > 0 && (
                                    <div className="space-y-2.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 ml-1">
                                        <Zap className="w-4 h-4" />
                                        Dịch vụ rút gọn ngoài (Tùy chọn)
                                      </div>
                                      {shortOptions.map(renderOption)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Khung hiển thị chi tiết đường dẫn đang chọn & nút thao tác */}
                          <div className="p-3.5 bg-white rounded-xl border border-teal-200 space-y-2 shadow-2xs">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                              <span>Đường dẫn đang chọn áp dụng:</span>
                              <span className="text-teal-700 font-semibold">{activeLinkItem.name}</span>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                              <Globe className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="text-[12px] font-mono font-semibold text-teal-900 select-all break-all flex-1">
                                {currentActiveUrl}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(currentActiveUrl)}
                                className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
                                  copied 
                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                    : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
                                }`}
                              >
                                {copied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    Đã chép
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Sao chép
                                  </>
                                )}
                              </button>

                              <a
                                href={currentActiveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shrink-0"
                                title="Mở thử nghiệm đường dẫn"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>

                            {/* Cam kết chất lượng link */}
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                <strong>Cam kết chất lượng:</strong> 100% Chuyển hướng trực tiếp (Direct Redirect), không qua trang quảng cáo trung gian, tốc độ mở trang tức thì.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
                      <Globe className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500 font-medium">
                        Nhập <strong>Đường dẫn định danh (Slug)</strong> ở trên để xem trước mã QR và nhận danh sách link rút gọn không quảng cáo.
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors text-xs sm:text-sm"
              >
                Hủy
              </button>
              <button
                form="user-form"
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70 shadow-sm text-xs sm:text-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
