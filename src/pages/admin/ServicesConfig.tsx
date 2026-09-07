import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Trash2, Edit2, Plus, Clock, Settings2 } from 'lucide-react';

export default function ServicesConfig() {
  const [services, setServices] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ workingHours: {}, intervalStep: 30 });
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingService, setEditingService] = useState<any>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const fetchServicesAndConfig = async () => {
    setLoading(true);
    try {
      const [resSvc, resCfg] = await Promise.all([
        api.get('/admin/services'),
        api.get('/admin/config')
      ]);
      setServices(resSvc.data.data || []);
      setConfig(resCfg.data.data || { workingHours: {}, intervalStep: 30 });
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesAndConfig();
  }, []);

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService.id) {
        await api.put(`/admin/services/${editingService.id}`, editingService);
        toast.success('Cập nhật dịch vụ thành công');
      } else {
        await api.post('/admin/services', editingService);
        toast.success('Thêm dịch vụ thành công');
      }
      setShowServiceForm(false);
      setEditingService(null);
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi lưu dịch vụ');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa dịch vụ này?')) return;
    try {
      await api.delete(`/admin/services/${id}`);
      toast.success('Đã xóa dịch vụ');
      fetchServicesAndConfig();
    } catch (err) {
      toast.error('Lỗi khi xóa dịch vụ');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/admin/config', config);
      toast.success('Lưu cấu hình lịch làm việc thành công!');
    } catch (err) {
      toast.error('Lỗi khi lưu cấu hình');
    }
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Thứ 2' },
    { key: 'tuesday', label: 'Thứ 3' },
    { key: 'wednesday', label: 'Thứ 4' },
    { key: 'thursday', label: 'Thứ 5' },
    { key: 'friday', label: 'Thứ 6' },
    { key: 'saturday', label: 'Thứ 7' },
    { key: 'sunday', label: 'Chủ nhật' },
  ];

  const handleUpdateShift = (dayKey: string, shiftIndex: number, field: 'start' | 'end', value: string) => {
    const newConfig = { ...config };
    if (!newConfig.workingHours[dayKey]) newConfig.workingHours[dayKey] = [{ start: '', end: '' }];
    newConfig.workingHours[dayKey][shiftIndex][field] = value;
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

  if (loading) return <div className="p-8 text-center text-text-muted">Đang tải...</div>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Cấu hình Dịch vụ */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Danh sách Dịch vụ</CardTitle>
          <Button size="sm" onClick={() => { setEditingService({ name: '', durationMins: 30, bufferBefore: 0, bufferAfter: 0, price: '', showPrice: false, isHot: false, isActive: true }); setShowServiceForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Thêm dịch vụ
          </Button>
        </CardHeader>
        <CardContent>
          {showServiceForm && editingService && (
            <div className="mb-6 p-4 border border-border-subtle rounded-lg bg-bg-base relative">
              <h4 className="font-semibold mb-4 text-sm">{editingService.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}</h4>
              <form onSubmit={handleSaveService} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-muted">Tên dịch vụ</label>
                  <Input required value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted">Thời gian khám (phút)</label>
                    <Input type="number" required value={editingService.durationMins} onChange={e => setEditingService({...editingService, durationMins: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted">Buffer sau khám (phút)</label>
                    <Input type="number" value={editingService.bufferAfter} onChange={e => setEditingService({...editingService, bufferAfter: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">Giá dịch vụ (VNĐ)</label>
                  <Input type="number" placeholder="Ví dụ: 500000" value={editingService.price || ''} onChange={e => setEditingService({...editingService, price: e.target.value})} />
                </div>
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer">
                    <input type="checkbox" checked={editingService.isActive !== false} onChange={e => setEditingService({...editingService, isActive: e.target.checked})} className="rounded border-border-subtle text-primary focus:ring-teal-600" />
                    <span>Đang hoạt động</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer">
                    <input type="checkbox" checked={editingService.showPrice || false} onChange={e => setEditingService({...editingService, showPrice: e.target.checked})} className="rounded border-border-subtle text-primary focus:ring-teal-600" />
                    <span>Hiển thị giá</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer">
                    <input type="checkbox" checked={editingService.isHot || false} onChange={e => setEditingService({...editingService, isHot: e.target.checked})} className="rounded border-border-subtle text-primary focus:ring-teal-600" />
                    <span>Nổi bật (HOT)</span>
                  </label>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowServiceForm(false)}>Hủy</Button>
                  <Button type="submit" size="sm">Lưu</Button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {services.map(svc => (
              <div key={svc.id} className={`flex justify-between items-center p-3 border border-border-subtle rounded transition-colors ${svc.isActive === false ? 'bg-slate-50 opacity-60' : 'hover:bg-bg-base'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium text-sm ${svc.isActive === false ? 'text-slate-500 line-through' : 'text-text-main'}`}>{svc.name}</h4>
                    {svc.isHot && svc.isActive !== false && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-sm">HOT</span>
                    )}
                    {svc.isActive === false && (
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-sm">Ngừng hoạt động</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {svc.durationMins} phút khám
                      {svc.bufferAfter > 0 && ` + ${svc.bufferAfter} phút dọn dẹp`}
                    </span>
                    {svc.price && svc.showPrice && (
                      <span className="font-medium text-teal-600">
                        {Number(svc.price).toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => { setEditingService(svc); setShowServiceForm(true); }} className="p-1 text-text-muted/60 hover:text-primary transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteService(svc.id)} className="p-1 text-text-muted/60 hover:text-status-cancelled transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="text-sm text-text-muted">Chưa có dịch vụ nào.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Cấu hình Lịch làm việc */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-1">
        <CardHeader>
          <CardTitle>Khung giờ & Ngày làm việc</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main flex items-center">
                <Settings2 className="w-4 h-4 mr-2" />
                Khoảng chia lịch (Interval)
              </label>
              <p className="text-xs text-text-muted mb-2">Chia nhỏ lịch hẹn thành từng đoạn bao nhiêu phút trên màn hình chọn giờ?</p>
              <select 
                className="w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                value={config.intervalStep}
                onChange={e => setConfig({...config, intervalStep: parseInt(e.target.value)})}
              >
                <option value={15}>15 phút / slot</option>
                <option value={30}>30 phút / slot</option>
                <option value={45}>45 phút / slot</option>
                <option value={60}>60 phút / slot</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-text-main">Các ngày mở cửa trong tuần</label>
              {daysOfWeek.map(day => {
                const isActive = config.workingHours[day.key] && config.workingHours[day.key].length > 0;
                return (
                  <div key={day.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2.5 rounded-xl bg-bg-base/60 sm:bg-transparent border border-border-subtle sm:border-0">
                    <div className="w-full sm:w-28 flex items-center justify-between sm:justify-start">
                      <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer font-medium">
                        <input 
                          type="checkbox" 
                          checked={isActive} 
                          onChange={() => handleToggleDay(day.key)}
                          className="rounded border-border-subtle text-primary focus:ring-teal-600"
                        />
                        <span>{day.label}</span>
                      </label>
                      <span className="sm:hidden text-xs text-text-muted">
                        {isActive ? 'Mở cửa' : 'Nghỉ'}
                      </span>
                    </div>
                    {isActive ? (
                      <div className="flex flex-1 items-center space-x-2">
                        <Input 
                          type="time" 
                          className="h-8 text-xs sm:text-sm flex-1" 
                          value={config.workingHours[day.key][0]?.start || '08:00'} 
                          onChange={e => handleUpdateShift(day.key, 0, 'start', e.target.value)} 
                        />
                        <span className="text-text-muted/60">-</span>
                        <Input 
                          type="time" 
                          className="h-8 text-xs sm:text-sm flex-1" 
                          value={config.workingHours[day.key][0]?.end || '17:00'} 
                          onChange={e => handleUpdateShift(day.key, 0, 'end', e.target.value)} 
                        />
                      </div>
                    ) : (
                      <span className="hidden sm:inline text-sm text-text-muted/60 italic">Nghỉ</span>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="submit" className="w-full">Lưu cấu hình</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
