import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft, Loader2, Edit3, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { APPOINTMENT_STATUSES } from '../../constants/appointmentStatus';
import { toast } from 'react-hot-toast';
import RescheduleModal from './components/RescheduleModal';

interface AppointmentData {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  serviceId: string;
  serviceName: string;
  providerName: string | null;
  patientName: string;
}

export default function MyBooking() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [isFromLocalStorage, setIsFromLocalStorage] = useState(true);
  const [hasHistory, setHasHistory] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [rescheduleData, setRescheduleData] = useState<{isOpen: boolean, appointmentId: string | null, serviceId: string | null}>({isOpen: false, appointmentId: null, serviceId: null});
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  
  const handleCancel = async (id: string) => {
    let phoneToUse = verifiedPhone;
    if (!phoneToUse) {
      toast.error('Không tìm thấy số điện thoại xác thực');
      return;
    }
    setConfirmCancelId(null);
    setActionLoading(id);
    try {
      const res = await api.patch(`/public/appointments/${id}/cancel`, { phone: phoneToUse });
      if (res.data.success) {
        toast.success("Hủy lịch thành công");
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCEL_PATIENT' } : a));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Không thể hủy lịch, vui lòng kiểm tra số điện thoại.");
    } finally {
      setActionLoading(null);
    }
  };
  
  const handleRescheduleSuccess = (appointmentId: string, newStartAt: string, newEndAt: string) => {
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { 
      ...a, 
      status: 'REQUESTED',
      startAt: newStartAt,
      endAt: newEndAt
    } : a));
    setRescheduleData({ isOpen: false, appointmentId: null, serviceId: null });
  };

  const handleSearch = async (e?: React.FormEvent, submitPin?: string) => {
    if (e) e.preventDefault();
    if (!searchPhone || !searchName) {
      toast.error("Vui lòng nhập cả số điện thoại và họ tên");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.post('/public/appointments/lookup', { 
        phone: searchPhone, 
        fullName: searchName,
        pin: submitPin || undefined
      });
      if (res.data.success) {
        setAppointments(res.data.data);
        setVerifiedPhone(searchPhone);
        setIsFromLocalStorage(false);
        setHasHistory(res.data.hasHistory || false);
        
        if (submitPin) {
          setShowPinInput(false);
          toast.success("Mở khóa lịch sử thành công");
        }
        
        if (res.data.data.length === 0 && !res.data.hasHistory) {
          toast.error("Không tìm thấy lịch hẹn nào với thông tin này");
        } else if (!submitPin) {
          localStorage.setItem('verifiedPatient', JSON.stringify({ phone: searchPhone, fullName: searchName }));
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Lỗi khi tra cứu lịch hẹn");
    } finally {
      setSearchLoading(false);
    }
  };
  
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      toast.error("Vui lòng nhập mã PIN");
      return;
    }
    handleSearch(undefined, pin);
  };

  
  const handleClearHistory = () => {
    setLogoutConfirmOpen(true);
  };
  
  const performLogout = () => {
    localStorage.removeItem('verifiedPatient');
    setAppointments([]);
    setSearchPhone('');
    setSearchName('');
    setLogoutConfirmOpen(false);
    toast.success("Đã đăng xuất hồ sơ an toàn");
  };


  useEffect(() => {
    const fetchAppointments = async () => {
      const vpStr = localStorage.getItem('verifiedPatient');
      if (!vpStr) {
        setLoading(false);
        return;
      }
      
      try {
        const vp = JSON.parse(vpStr);
        if (vp.phone && vp.fullName) {
          setSearchPhone(vp.phone);
          setSearchName(vp.fullName);
          setIsFromLocalStorage(true);
          const res = await api.post('/public/appointments/lookup', { phone: vp.phone, fullName: vp.fullName });
          if (res.data.success) {
            setAppointments(res.data.data);
            setVerifiedPhone(vp.phone);
            setHasHistory(res.data.hasHistory || false);
          } else {
            localStorage.removeItem('verifiedPatient');
          }
        }
      } catch (err) {
        console.error('Error fetching local appointments', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          <Link to="/book/dich-vu" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors text-text-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main">
            Lịch hẹn của tôi
          </h1>
        </header>

        {/* Lookup Form for Self-Reschedule */}
        <form onSubmit={handleSearch} className="mb-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
           <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-3">Tra cứu lịch hẹn</h3>
           <div className="flex flex-col sm:flex-row gap-3">
             <input type="text" value={searchPhone || ''} onChange={(e) => setSearchPhone(e.target.value)} placeholder="Nhập số điện thoại..." className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all" />
             <input type="text" value={searchName || ''} onChange={(e) => setSearchName(e.target.value)} placeholder="Họ và tên..." className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all" />
             <button type="submit" disabled={searchLoading} className="h-11 px-6 bg-slate-800 text-white font-semibold text-[13px] rounded-xl hover:bg-slate-700 transition-colors whitespace-nowrap flex items-center justify-center">
               {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tra cứu an toàn'}
             </button>
           </div>
           <p className="text-[11px] text-slate-400 mt-2">Nhập chính xác Số điện thoại và Họ tên để xác thực và xem lịch sử.</p>
        </form>

        {loading ? (
          <div className="text-center py-12 text-text-muted">Đang tải...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-card border border-border-subtle">
            <p className="text-text-muted mb-4">Bạn chưa có lịch hẹn nào hoặc bạn dùng trình duyệt khác.</p>
            <Link to="/book/dich-vu" className="text-primary font-medium hover:underline">
              Đặt lịch mới ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {isFromLocalStorage && (
              <div className="flex justify-between items-center mb-4">
                <p className="text-[13px] text-slate-500">Đang hiển thị lịch hẹn của <strong className="text-slate-700">{searchName}</strong> ({searchPhone})</p>
                <button onClick={handleClearHistory} className="text-[13px] text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
            {appointments.map(apt => {
              const statusConfig = APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES] || APPOINTMENT_STATUSES.PENDING;
              const StatusIcon = statusConfig.icon;
              return (
                <Card key={apt.id} className="border border-border-subtle shadow-soft bg-surface">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4 border-b border-border-subtle pb-4">
                      <div>
                        <h3 className="font-bold text-text-main">{apt.serviceName}</h3>
                        <p className="text-sm text-text-muted mt-1 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5" />
                          {apt.providerName || 'Bác sĩ chuyên khoa'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-text-muted block mb-1">Ngày hẹn</span>
                        <div className="font-medium text-text-main flex items-center gap-1.5">
                          <CalendarIcon className="w-4 h-4 text-primary" />
                          {format(new Date(apt.startAt), 'dd/MM/yyyy')}
                        </div>
                      </div>
                      <div>
                        <span className="text-text-muted block mb-1">Giờ hẹn</span>
                        <div className="font-medium text-text-main flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" />
                          {format(new Date(apt.startAt), 'HH:mm')} - {format(new Date(apt.endAt), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  {(apt.status === 'REQUESTED' || apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-xl">
                      <button 
                        disabled={actionLoading === apt.id}
                        onClick={() => setConfirmCancelId(apt.id)}
                        className="px-4 py-2 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {actionLoading === apt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Hủy lịch
                      </button>
                      <button 
                        disabled={actionLoading === apt.id}
                        onClick={() => setRescheduleData({ isOpen: true, appointmentId: apt.id, serviceId: apt.serviceId })}
                        className="px-4 py-2 text-xs font-semibold text-teal-600 bg-white border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-4 h-4" />
                        Dời lịch
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        
        {hasHistory && !showPinInput && (
          <div className="mt-8 text-center border-t border-slate-200 pt-8">
            <h4 className="text-[14px] font-bold text-slate-800 mb-2">Lịch sử khám & Bệnh án cũ</h4>
            <p className="text-[13px] text-slate-500 mb-4 max-w-sm mx-auto">Để bảo mật thông tin y tế, vui lòng nhập mã PIN (Năm sinh hoặc 4 số cuối mã lịch hẹn gần nhất) để xem lịch sử khám của bạn.</p>
            <button 
              onClick={() => setShowPinInput(true)}
              className="px-6 py-2.5 bg-teal-600 text-white font-semibold text-[13px] rounded-xl hover:bg-teal-700 transition-colors inline-flex items-center gap-2"
            >
              Mở khóa lịch sử khám
            </button>
          </div>
        )}
        
        {hasHistory && showPinInput && (
          <div className="mt-8 border-t border-slate-200 pt-8">
            <div className="max-w-sm mx-auto bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="text-[14px] font-bold text-slate-800 mb-2 text-center">Xác thực mã PIN</h4>
              <p className="text-[12px] text-slate-500 mb-4 text-center">Nhập Năm sinh (VD: 1990) hoặc 4 số cuối mã lịch hẹn</p>
              <form onSubmit={handlePinSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value)} 
                  placeholder="Nhập mã PIN..." 
                  className="flex-1 h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-center font-bold tracking-widest" 
                />
                <button 
                  type="submit" 
                  disabled={searchLoading} 
                  className="h-11 px-6 bg-slate-800 text-white font-semibold text-[13px] rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Xác nhận
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      
      {/* Cancel Confirm Modal */}
      {confirmCancelId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 p-6">
             <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận hủy lịch</h3>
             <p className="text-sm text-slate-600 mb-6">Bạn có chắc chắn muốn hủy lịch hẹn này không? Hành động này không thể hoàn tác.</p>
             <div className="flex justify-end gap-3">
               <button onClick={() => setConfirmCancelId(null)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors text-sm">Đóng</button>
               <button onClick={() => handleCancel(confirmCancelId)} className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl font-medium transition-colors text-sm">Đồng ý hủy</button>
             </div>
          </div>
        </div>
      )}
      
      {/* Logout Confirm Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 p-6">
             <h3 className="text-lg font-bold text-slate-800 mb-2">Đăng xuất hồ sơ</h3>
             <p className="text-sm text-slate-600 mb-6">Bạn có chắc muốn đăng xuất hồ sơ khỏi thiết bị này? Bạn sẽ cần nhập lại Số điện thoại và Họ tên để tra cứu lần sau.</p>
             <div className="flex justify-end gap-3">
               <button onClick={() => setLogoutConfirmOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors text-sm">Hủy</button>
               <button onClick={performLogout} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-medium transition-colors text-sm">Đăng xuất</button>
             </div>
          </div>
        </div>
      )}

      <RescheduleModal
        isOpen={rescheduleData.isOpen}
        appointmentId={rescheduleData.appointmentId}
        serviceId={rescheduleData.serviceId}
        verifiedPhone={verifiedPhone}
        onClose={() => setRescheduleData({ isOpen: false, appointmentId: null, serviceId: null })}
        onSuccess={handleRescheduleSuccess}
      />
    </div>
  );
}
