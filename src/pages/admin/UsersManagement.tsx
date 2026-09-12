import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';
import {  
  Users, ShieldCheck, Key, Lock, Unlock, X, Edit, 
  Plus, CheckCircle2, AlertTriangle, RefreshCw, Loader2
, Eye, EyeOff, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

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
  
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

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
    setSlug(u.slug || '');
    
    setMsg('');
    setIsError(false);
    setShowModal(true);
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">
                {modalMode === 'create' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 grow">
              <form id="user-form" onSubmit={handleSubmit} className="space-y-8">
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
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Cột 1: Thông tin cơ bản */}
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Thông tin đăng nhập
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Tên tài khoản / Email</label>
                          <input 
                            type="text" 
                            placeholder="VD: admin hoặc admin@phongkham.vn" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required={modalMode === 'create'}
                            disabled={modalMode === 'edit'}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                          />
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">
                            {modalMode === 'edit' ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
                          </label>
                          <div className="relative">
                            <input 
                              type={showPassword ? 'text' : 'password'} 
                              placeholder="Tối thiểu 6 ký tự" 
                              value={password} 
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
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">
                            Xác nhận mật khẩu
                          </label>
                          <div className="relative">
                            <input 
                              type={showConfirmPassword ? 'text' : 'password'} 
                              placeholder="Nhập lại mật khẩu" 
                              value={confirmPassword} 
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
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Cấu hình phòng khám
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Đường dẫn định danh (Slug)</label>
                          <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="VD: nha-khoa-le-phuong"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
                            Đường dẫn đặt khám: <br/>
                            <a href={`${window.location.origin}/booking/${slug || '...'}`} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline break-all">
                              {window.location.origin}/booking/{slug || '...'}
                            </a>
                          </p>
                        </div>
                        
                        {slug && (
                          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0">
                              <QRCodeSVG 
                                id="qr-code-canvas"
                                value={`${window.location.origin}/booking/${slug}`} 
                                size={80} 
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-slate-700 font-medium">Mã QR đặt lịch</p>
                              <p className="text-xs text-slate-500 leading-relaxed">Bệnh nhân có thể quét mã này để truy cập trực tiếp vào trang đặt lịch của phòng khám.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const canvas = document.getElementById('qr-code-canvas');
                                  if (canvas) {
                                    // qrcode.react renders as SVG by default, we need to convert it or use canvas. 
                                    // Let's change QRCodeSVG to QRCodeCanvas if we want simple download, but SVG download is also possible.
                                    // Since we imported QRCodeSVG, we can download it as SVG.
                                    const svgData = new XMLSerializer().serializeToString(canvas);
                                    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `qr-${slug}.svg`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Tải mã QR
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Giao diện hiển thị</label>
                          <select
                            value={uiMode}
                            onChange={(e) => setUiMode(e.target.value as 'full' | 'simple')}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                          >
                            <option value="full">Đầy đủ (Nâng cao)</option>
                            <option value="simple">Đơn giản (Tối giản)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Phân quyền */}
                  <div>
                    <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      Phân quyền chức năng
                    </h4>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/50 h-[calc(100%-2rem)] overflow-y-auto divide-y divide-slate-200/60 shadow-inner">
                      {PERMISSION_MATRIX.map(module => (
                        <div key={module.module} className="p-5 space-y-4">
                          <h5 className="text-sm font-bold text-slate-800">{module.module}</h5>
                          <div className="flex flex-col gap-3">
                            {module.permissions.map(p => (
                              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:border-primary checked:bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                                </div>
                                <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 transition-colors select-none">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                form="user-form"
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70 shadow-sm"
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
