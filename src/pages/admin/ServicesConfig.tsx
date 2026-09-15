import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Clock, 
  Settings2, 
  X, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Stethoscope, 
  Search, 
  Calendar as CalendarIcon,
  Check, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Flame, 
  Tag, 
  Copy, 
  Sun, 
  Moon, 
  Coffee,
  ShieldCheck,
  Award,
  Layers,
  Activity
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';

export default function ServicesConfig() {
  const [services, setServices] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ workingHours: {}, intervalStep: 30 });
  const [loading, setLoading] = useState(true);
  const { hasPermission } = usePermissions();
  const [savingConfig, setSavingConfig] = useState(false);

  // Search & Filter
  const [serviceSearch, setServiceSearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');

  // Form modal states
  const [editingService, setEditingService] = useState<any>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);

  const fetchServicesAndConfig = async () => {
    setLoading(true);
    try {
      const [resSvc, resPrv, resCfg] = await Promise.all([
        api.get('/admin/services'),
        api.get('/admin/providers'),
        api.get('/admin/config')
      ]);
      setServices(resSvc.data?.data || []);
      setProviders(resPrv.data?.data || []);
      setConfig(resCfg.data?.data || { workingHours: {}, intervalStep: 30 });
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu cấu hình phòng khám');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesAndConfig();
  }, []);

  // Filtered Services
  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase().trim();
    return services.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.tags && s.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }, [services, serviceSearch]);

  // Filtered Providers
  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return providers;
    const q = providerSearch.toLowerCase().trim();
    return providers.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.specialty && p.specialty.toLowerCase().includes(q))
    );
  }, [providers, providerSearch]);

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService.id) {
        await api.put(`/admin/services/${editingService.id}`, editingService);
        toast.success('Cập nhật dịch vụ thành công');
      } else {
        await api.post('/admin/services', editingService);
        toast.success('Thêm dịch vụ mới thành công');
      }
      setShowServiceForm(false);
      setEditingService(null);
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi lưu thông tin dịch vụ');
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dịch vụ "${name}"?`)) return;
    try {
      await api.delete(`/admin/services/${id}`);
      toast.success('Đã xóa dịch vụ');
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi xóa dịch vụ');
    }
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProvider.id) {
        await api.put(`/admin/providers/${editingProvider.id}`, editingProvider);
        toast.success('Cập nhật thông tin bác sĩ thành công');
      } else {
        await api.post('/admin/providers', editingProvider);
        toast.success('Thêm bác sĩ mới thành công');
      }
      setShowProviderForm(false);
      setEditingProvider(null);
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi lưu thông tin bác sĩ');
    }
  };

  const handleDeleteProvider = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bác sĩ "${name}"?`)) return;
    try {
      await api.delete(`/admin/providers/${id}`);
      toast.success('Đã xóa bác sĩ');
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi xóa bác sĩ');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put('/admin/config', config);
      toast.success('Đã cập nhật lịch làm việc phòng khám!');
    } catch (err) {
      toast.error('Lỗi khi lưu cấu hình lịch');
    } finally {
      setSavingConfig(false);
    }
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Thứ Hai', short: 'T2' },
    { key: 'tuesday', label: 'Thứ Ba', short: 'T3' },
    { key: 'wednesday', label: 'Thứ Tư', short: 'T4' },
    { key: 'thursday', label: 'Thứ Năm', short: 'T5' },
    { key: 'friday', label: 'Thứ Sáu', short: 'T6' },
    { key: 'saturday', label: 'Thứ Bảy', short: 'T7' },
    { key: 'sunday', label: 'Chủ Nhật', short: 'CN' },
  ];

  const handleUpdateShift = (dayKey: string, field: 'start' | 'end', value: string) => {
    const newConfig = { ...config };
    if (!newConfig.workingHours[dayKey] || newConfig.workingHours[dayKey].length === 0) {
      newConfig.workingHours[dayKey] = [{ start: '08:00', end: '17:00' }];
    }
    newConfig.workingHours[dayKey][0][field] = value;
    setConfig(newConfig);
  };

  const handleToggleDay = (dayKey: string) => {
    const newConfig = { ...config };
    if (newConfig.workingHours[dayKey] && newConfig.workingHours[dayKey].length > 0) {
      newConfig.workingHours[dayKey] = [];
    } else {
      newConfig.workingHours[dayKey] = [{ start: '08:00', end: '17:00' }];
    }
    setConfig(newConfig);
  };

  // Quick Preset Handlers
  const applyStandardHoursAllWeek = () => {
    const newConfig = { ...config };
    daysOfWeek.forEach(d => {
      newConfig.workingHours[d.key] = [{ start: '08:00', end: '17:00' }];
    });
    setConfig(newConfig);
    toast.success('Đã thiết lập 08:00 - 17:00 cho tất cả các ngày');
  };

  const applyWeekendOff = () => {
    const newConfig = { ...config };
    daysOfWeek.forEach(d => {
      if (d.key === 'saturday' || d.key === 'sunday') {
        newConfig.workingHours[d.key] = [];
      } else {
        newConfig.workingHours[d.key] = [{ start: '08:00', end: '17:00' }];
      }
    });
    setConfig(newConfig);
    toast.success('Đã áp dụng nghỉ Thứ Bảy và Chủ Nhật');
  };

  // Helper to pick dental service icon and colors
  const getServiceVisuals = (name: string = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('nhổ') || lower.includes('tiểu phẫu')) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Activity };
    }
    if (lower.includes('trắng') || lower.includes('thẩm mỹ')) {
      return { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: Sparkles };
    }
    if (lower.includes('cạo vôi') || lower.includes('đánh bóng') || lower.includes('vệ sinh')) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck };
    }
    if (lower.includes('implant') || lower.includes('sứ') || lower.includes('niềng')) {
      return { bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
    }
    return { bg: 'bg-teal-50 text-teal-700 border-teal-200', icon: Stethoscope };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] p-8 space-y-3">
        <div className="w-10 h-10 border-3 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-700">Đang tải danh mục dịch vụ & lịch làm việc...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100 shadow-2xs">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Quản lý Dịch vụ & Lịch làm việc
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {services.length} Dịch vụ • {providers.length} Bác sĩ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Tùy chỉnh danh mục khám chữa, phân bổ bác sĩ chuyên môn và cấu hình thời gian mở cửa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {hasPermission('service.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingService({ 
                name: '', 
                durationMins: 30, 
                bufferBefore: 0, 
                bufferAfter: 10, 
                price: '', 
                showPrice: true, 
                isHot: false, 
                isFree: false, 
                isActive: true,
                tags: []
              });
              setShowServiceForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm dịch vụ</span>
          </button>
          )}
          {hasPermission('provider.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingProvider({ 
                name: '', 
                specialty: '', 
                experience: '',
                isDefault: false, 
                isActive: true, 
                bookingEnabled: true,
                specialties: [],
                certificates: []
              });
              setShowProviderForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bác sĩ</span>
          </button>
          )}
        </div>
      </div>

      {/* Grid: 2 Cột Dịch vụ & Bác sĩ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CỘT 1: DANH SÁCH DỊCH VỤ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Header Card */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-800 text-base">Danh mục Dịch vụ ({filteredServices.length})</h3>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Tìm tên dịch vụ, tag..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {serviceSearch && (
                <button
                  onClick={() => setServiceSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Items */}
          <div className="p-4 sm:p-5 flex-1 space-y-3 max-h-[580px] overflow-y-auto">
            {filteredServices.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                {serviceSearch ? 'Không tìm thấy dịch vụ phù hợp với từ khóa.' : 'Chưa có dịch vụ nào trong hệ thống.'}
              </div>
            ) : (
              filteredServices.map(svc => {
                const visual = getServiceVisuals(svc.name);
                const IconComp = visual.icon;
                const isInactive = svc.isActive === false;

                return (
                  <div
                    key={svc.id}
                    className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex items-start justify-between gap-3 ${
                      isInactive 
                        ? 'bg-slate-50/70 border-slate-200/60 opacity-60' 
                        : 'bg-white border-slate-200/80 hover:border-teal-300 hover:shadow-xs hover:bg-teal-50/10'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Visual Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${visual.bg} shadow-2xs`}>
                        <IconComp className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm font-bold truncate ${isInactive ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {svc.name}
                          </h4>
                          {svc.isHot && !isInactive && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold bg-gradient-to-r from-rose-500 to-amber-500 text-white px-1.5 py-0.5 rounded-md shadow-2xs uppercase">
                              <Flame className="w-2.5 h-2.5 fill-white" /> HOT
                            </span>
                          )}
                          {isInactive && (
                            <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">
                              Tạm ngưng
                            </span>
                          )}
                        </div>

                        {/* Details: Duration & Price */}
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/60">
                            <Clock className="w-3 h-3 text-teal-600" />
                            {svc.durationMins || 30} phút
                            {svc.bufferAfter > 0 && <span className="text-slate-400">+{svc.bufferAfter}p dọn dẹp</span>}
                          </span>

                          {/* Price Tag */}
                          {svc.isFree ? (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60 text-xs">
                              Miễn phí
                            </span>
                          ) : (svc.price != null && svc.price !== '' && svc.showPrice !== false) ? (
                            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200/60 text-xs">
                              {Number(svc.price).toLocaleString('vi-VN')} đ
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Tư vấn báo giá
                            </span>
                          )}
                        </div>

                        {/* Extra tags */}
                        {svc.tags && svc.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {svc.tags.map((t: string, idx: number) => (
                              <span key={idx} className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.2 rounded-md">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {hasPermission('service.manage') && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingService({ ...svc });
                            setShowServiceForm(true);
                          }}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Chỉnh sửa dịch vụ"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteService(svc.id, svc.name)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Xóa dịch vụ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT 2: DANH SÁCH BÁC SĨ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Header Card */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-slate-800 text-base">Đội ngũ Bác sĩ ({filteredProviders.length})</h3>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Tìm tên bác sĩ, chuyên khoa..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {providerSearch && (
                <button
                  onClick={() => setProviderSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Items */}
          <div className="p-4 sm:p-5 flex-1 space-y-3 max-h-[580px] overflow-y-auto">
            {filteredProviders.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                {providerSearch ? 'Không tìm thấy bác sĩ phù hợp.' : 'Chưa có bác sĩ nào trong hệ thống.'}
              </div>
            ) : (
              filteredProviders.map(prv => {
                const isInactive = prv.isActive === false;
                const initials = prv.name ? prv.name.split(' ').map((n: string) => n[0]).slice(-2).join('').toUpperCase() : 'BS';

                return (
                  <div
                    key={prv.id}
                    className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex items-start justify-between gap-3 ${
                      isInactive 
                        ? 'bg-slate-50/70 border-slate-200/60 opacity-60' 
                        : 'bg-white border-slate-200/80 hover:border-teal-300 hover:shadow-xs hover:bg-teal-50/10'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs text-sm">
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm font-bold truncate ${isInactive ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {prv.name}
                          </h4>
                          {prv.isDefault && !isInactive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                              ⭐ Mặc định
                            </span>
                          )}
                          {isInactive && (
                            <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">
                              Nghỉ phép
                            </span>
                          )}
                        </div>

                        {/* Specialty & Exp */}
                        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                          <span className="font-medium text-slate-700">
                            {prv.specialty || 'Chuyên khoa Nha tổng quát'}
                          </span>
                          {prv.experience && (
                            <span className="text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md text-[11px] border border-teal-200/60">
                              {prv.experience}
                            </span>
                          )}
                        </div>

                        {/* Badges / Specialties */}
                        {prv.specialties && prv.specialties.length > 0 && (
                          <div className="flex items-center gap-1 pt-1 flex-wrap">
                            {prv.specialties.map((spec: string, idx: number) => (
                              <span key={idx} className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-md">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {hasPermission('provider.manage') && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProvider({ ...prv });
                            setShowProviderForm(true);
                          }}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Chỉnh sửa bác sĩ"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProvider(prv.id, prv.name)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Xóa bác sĩ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* TẦNG DƯỚI: CẤU HÌNH LỊCH LÀM VIỆC (WORKING HOURS & CALENDAR INTERVAL) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-teal-50/40 via-white to-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">Khung giờ & Ngày làm việc phòng khám</h3>
              <p className="text-xs text-slate-500">Cấu hình thời gian tiếp nhận bệnh nhân và khoảng phân đoạn lịch hẹn</p>
            </div>
          </div>

          {/* Quick Preset Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={applyStandardHoursAllWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Chuẩn 08:00 - 17:00</span>
            </button>
            <button
              type="button"
              onClick={applyWeekendOff}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Coffee className="w-3.5 h-3.5 text-slate-500" />
              <span>Nghỉ Thứ 7 & CN</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="p-4 sm:p-6 space-y-6">
          {/* 1. Khoảng chia lịch (Interval) */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-teal-600" />
                  Khoảng chia lịch (Slot Interval)
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chia nhỏ thời gian đặt hẹn thành các mốc bao nhiêu phút trên màn hình chọn giờ của bệnh nhân
                </p>
              </div>
            </div>

            {/* Radio Slot cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[15, 30, 45, 60].map((step) => {
                const isSelected = (config.intervalStep || 30) === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setConfig({ ...config, intervalStep: step })}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-sm sm:text-base font-bold">{step} phút / slot</div>
                    <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      {step === 30 ? 'Phổ biến nhất' : `${60 / step} ca / giờ`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Lịch mở cửa 7 ngày trong tuần */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 block">
              Thời gian mở cửa từng ngày trong tuần
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {daysOfWeek.map(day => {
                const isOpen = config.workingHours[day.key] && config.workingHours[day.key].length > 0;
                const shift = isOpen ? config.workingHours[day.key][0] : null;

                return (
                  <div
                    key={day.key}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isOpen 
                        ? 'bg-white border-slate-200/90 shadow-2xs' 
                        : 'bg-slate-50/80 border-slate-200/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                          isOpen ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {day.short}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{day.label}</span>
                      </div>

                      {/* Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleDay(day.key)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          isOpen 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {isOpen ? 'Mở cửa' : 'Nghỉ'}
                      </button>
                    </div>

                    {isOpen && shift ? (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="time"
                            value={shift.start || '08:00'}
                            onChange={(e) => handleUpdateShift(day.key, 'start', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                          />
                        </div>
                        <span className="text-slate-400 text-xs font-bold">-</span>
                        <div className="relative flex-1">
                          <input
                            type="time"
                            value={shift.end || '17:00'}
                            onChange={(e) => handleUpdateShift(day.key, 'end', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic py-1 text-center bg-slate-100/60 rounded-xl">
                        Không tiếp nhận lịch hẹn trong ngày này
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lưu cấu hình lịch làm việc</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: THÊM / SỬA DỊCH VỤ */}
      {showServiceForm && editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 via-white to-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-base sm:text-lg">
                  {editingService.id ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ nha khoa mới'}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setShowServiceForm(false)} 
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Tên dịch vụ *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cạo vôi răng & Đánh bóng"
                  value={editingService.name || ''}
                  onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Thời gian khám (phút) *</label>
                  <input
                    type="number"
                    required
                    min={5}
                    step={5}
                    value={editingService.durationMins || 30}
                    onChange={e => setEditingService({ ...editingService, durationMins: parseInt(e.target.value) || 30 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Thời gian dọn dẹp (phút)</label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={editingService.bufferAfter || 0}
                    onChange={e => setEditingService({ ...editingService, bufferAfter: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Giá dịch vụ (VNĐ)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 300,000"
                  disabled={editingService.isFree}
                  value={editingService.price != null && editingService.price !== '' ? Number(editingService.price).toLocaleString('vi-VN') : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setEditingService({ ...editingService, price: raw ? parseInt(raw) : '' });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Tag nổi bật (Cách nhau bởi dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="VD: KHÔNG ĐAU, TRẢ GÓP 0%, BẢO HÀNH 5 NĂM"
                  value={(editingService.tags || []).join(', ')}
                  onChange={e => setEditingService({ ...editingService, tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Checkbox Options */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.isActive !== false}
                    onChange={e => setEditingService({ ...editingService, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Đang hoạt động</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.isHot || false}
                    onChange={e => setEditingService({ ...editingService, isHot: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Dịch vụ nổi bật (HOT)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.isFree || false}
                    onChange={e => setEditingService({ ...editingService, isFree: e.target.checked, price: e.target.checked ? '' : editingService.price })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Miễn phí khám</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingService.showPrice !== false}
                    onChange={e => setEditingService({ ...editingService, showPrice: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Công khai giá trên web</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowServiceForm(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
                >
                  Lưu dịch vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM / SỬA BÁC SĨ */}
      {showProviderForm && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 via-white to-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-base sm:text-lg">
                  {editingProvider.id ? 'Chỉnh sửa bác sĩ' : 'Thêm bác sĩ điều trị mới'}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setShowProviderForm(false)} 
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Họ và tên Bác sĩ *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: BS. CKI Nguyễn Văn A"
                  value={editingProvider.name || ''}
                  onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Chuyên khoa</label>
                <input
                  type="text"
                  placeholder="VD: Chuyên khoa Răng Hàm Mặt, Chỉnh nha & Thẩm mỹ"
                  value={editingProvider.specialty || ''}
                  onChange={e => setEditingProvider({ ...editingProvider, specialty: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Kinh nghiệm chuyên môn</label>
                <input
                  type="text"
                  placeholder="VD: Hơn 10 năm kinh nghiệm tại BV Răng Hàm Mặt"
                  value={editingProvider.experience || ''}
                  onChange={e => setEditingProvider({ ...editingProvider, experience: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Thế mạnh điều trị (Tags - Cách nhau bởi dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="VD: Cấy ghép Implant, Chỉnh nha trong suốt, Phục hình sứ"
                  value={(editingProvider.specialties || []).join(', ')}
                  onChange={e => setEditingProvider({ ...editingProvider, specialties: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProvider.isActive !== false}
                    onChange={e => setEditingProvider({ ...editingProvider, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Đang tiếp nhận bệnh nhân</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProvider.isDefault || false}
                    onChange={e => setEditingProvider({ ...editingProvider, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Bác sĩ chỉ định mặc định</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProviderForm(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
                >
                  Lưu hồ sơ bác sĩ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
