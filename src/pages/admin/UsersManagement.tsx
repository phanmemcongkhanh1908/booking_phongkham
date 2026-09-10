import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';
import { 
  Users, ShieldCheck, Key, Lock, Unlock, X, Edit, 
  Plus, CheckCircle2, AlertTriangle, RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

const PERMISSION_MATRIX = [
  {
    module: 'Hệ thống (Quản trị cao cấp)',
    permissions: [
      { id: '*', label: 'Toàn quyền (Super Admin)' },
    ]
  },
  {
    module: 'Lịch hẹn & Khách hàng',
    permissions: [
      { id: 'appointment.view', label: 'Xem danh sách' },
      { id: 'appointment.create', label: 'Thêm lịch hẹn' },
      { id: 'appointment.update', label: 'Cập nhật & Xóa' },
      { id: 'patient.view', label: 'Hồ sơ bệnh nhân' },
    ]
  },
  {
    module: 'Vận hành & Dữ liệu',
    permissions: [
      { id: 'service.manage', label: 'Dịch vụ & Bác sĩ' },
      { id: 'analytics.view', label: 'Thống kê & Báo cáo' },
    ]
  },
  {
    module: 'Cài đặt hệ thống',
    permissions: [
      { id: 'user.create', label: 'Quản lý nhân sự' },
      { id: 'setting.manage', label: 'Cấu hình chung' },
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['*']);
  
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
    setSelectedPermissions(['*']);
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
    
    setMsg('');
    setIsError(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          permissions: selectedPermissions
        });
        setMsg(`Tạo tài khoản '${trimmedIdentifier}' thành công!`);
      } else {
        const updateData: any = { permissions: selectedPermissions };
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
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Tài khoản / Email</th>
                <th className="px-6 py-4">Quyền hạn</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, idx) => {
                const isSuperAdmin = u.email === 'admin@dentalsmartbooking.com';
                const hasAll = u.permissions?.includes('*') || u.rolePermissions?.includes('*') || u.roleName === 'admin';
                return (
                  <tr key={u.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${u.isActive === false ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-700'}`}>
                        {hasAll ? 'Toàn quyền' : (u.permissions?.length ? `${u.permissions.length} quyền` : (u.roleName || 'guest'))}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${u.isActive === false ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                        <span className={u.isActive === false ? 'text-slate-400' : 'text-slate-700'}>
                          {u.isActive === false ? 'Đã khóa' : 'Hoạt động'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === 'create' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {msg && (
                <div className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                  isError 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{msg}</span>
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Tên tài khoản / Email</label>
                <input 
                  type="text" 
                  placeholder="VD: admin hoặc admin@phongkham.vn" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required={modalMode === 'create'}
                  disabled={modalMode === 'edit'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  {modalMode === 'edit' ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
                </label>
                <input 
                  type="text" 
                  placeholder="Tối thiểu 6 ký tự" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required={modalMode === 'create'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phân quyền chức năng</label>
                <div className="border border-slate-200 rounded-xl bg-slate-50/50 max-h-[280px] overflow-y-auto divide-y divide-slate-200/60">
                  {PERMISSION_MATRIX.map(module => (
                    <div key={module.module} className="p-4 space-y-3">
                      <h4 className="text-sm font-bold text-slate-800">{module.module}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {module.permissions.map(p => (
                          <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
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
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
