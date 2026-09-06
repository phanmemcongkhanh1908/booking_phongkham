import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';
import { format, differenceInMinutes, startOfWeek } from 'date-fns';
import { APPOINTMENT_STATUSES, LABEL_OVERRIDES } from '../../constants/appointmentStatus';
import Settings from './Settings';
import CalendarView from './CalendarView';
import ServicesConfig from './ServicesConfig';
import Analytics from './Analytics';
import Patients from './Patients';
import QrScanner from './components/QrScanner';
import { LayoutList, Calendar, BarChart3, Users, CalendarPlus, QrCode, Settings as SettingsIcon, LogOut, UserPlus, Clock, CheckCircle, Bell, BellOff, Volume2, VolumeX, X } from 'lucide-react';

export default function Dashboard() {
  const logout = useAuthStore((state) => state.logout);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  const [activeTab, setActiveTab] = useState<'appointments' | 'patients' | 'settings' | 'services' | 'analytics'>('appointments');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [clinicProfile, setClinicProfile] = useState<any>(null);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const knownAppointmentIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const addToast = (title: string, message: string, type: 'new' | 'reminder' = 'new') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000); // 10 seconds display
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const playTTS = (text: string) => {
    if (!audioEnabledRef.current || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // clear previous
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };


  useEffect(() => {
    api.get('/admin/settings').then(res => {
      if (res.data.data && res.data.data.clinicProfile) {
        setClinicProfile(res.data.data.clinicProfile);
      }
    }).catch(console.error);
  }, []);


  
  const fetchAppointments = async (showLoading = true) => {
    if (showLoading && isInitialLoad.current) setLoading(true);
    try {
      
      // Load current month's appointments to cover calendar view and list view
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = new Date();
      end.setMonth(end.getMonth() + 2); // get up to next month
      
      const res = await api.get('/appointments', {
        params: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        }
      });

      if (res.data.success) {
        const fetchedAppts = res.data.data;
        
        if (!isInitialLoad.current) {
          // Check for new bookings
          const newAppts = fetchedAppts.filter((a: any) => 
            !knownAppointmentIds.current.has(a.id) && 
            (a.status === 'REQUESTED' || a.status === 'PENDING' || a.status === 'CONFIRMED')
          );
          
          if (newAppts.length > 0) {
            newAppts.forEach((appt: any) => {
              const dateStr = format(new Date(appt.startAt), 'dd/MM');
              const timeStr = format(new Date(appt.startAt), 'HH:mm');
              const msgText = `Có khách hàng tên ${appt.patientName} đã đặt hẹn dịch vụ ${appt.serviceName} vào lúc ${timeStr} ngày ${dateStr}.`;
              
              addToast('Lịch hẹn mới', msgText, 'new');
              playTTS(msgText);
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Lịch hẹn mới', { body: msgText, icon: '/pwa-192x192.png' });
              }
            });
          }
        }
        
        // Update known IDs
        fetchedAppts.forEach((a: any) => knownAppointmentIds.current.add(a.id));
        setAppointments(fetchedAppts);
        isInitialLoad.current = false;
      }
    } catch (error) {
      if (error.response?.status !== 401) { console.error("Failed to load appointments", error); }
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients');
      if (res.data.success) {
        setPatients(res.data.data);
      }
    } catch (error) {
      if (error.response?.status !== 401) { console.error("Failed to load patients", error); }
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, []);

  const notifiedApptsRef = useRef<Set<string>>(new Set());

  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);
  
  const appointmentsRef = useRef(appointments);
  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);


  
  // Ask for notification permissions on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Poll for appointments every 15 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchAppointments(false);
    }, 15000);
    return () => clearInterval(pollInterval);
  }, []);

  // Check for upcoming appointments every minute
  useEffect(() => {
    const checkUpcomingAppointments = () => {
      const now = new Date();
      appointmentsRef.current.forEach(appt => {
        if (appt.status !== 'REQUESTED' && appt.status !== 'CONFIRMED') return;
        if (!appt.startAt) return;

        const diff = differenceInMinutes(new Date(appt.startAt), now);
        
        // Target 15 and 30 minute thresholds (give or take a minute)
        if (diff > 0 && ((diff <= 30 && diff >= 29) || (diff <= 15 && diff >= 14))) {
          const threshold = diff <= 15 ? 15 : 30;
          const notifKey = `${appt.id}-${threshold}`;
          
          if (!notifiedApptsRef.current.has(notifKey)) {
            const timeStr = format(new Date(appt.startAt), 'HH:mm');
            const msgText = `Sắp đến lịch hẹn của khách hàng ${appt.patientName} vào lúc ${timeStr}.`;
            
            addToast('Nhắc nhở lịch hẹn', msgText, 'reminder');
            playTTS(msgText);

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Nhắc nhở lịch hẹn', {
                body: msgText,
                icon: '/pwa-192x192.png'
              });
            }
            notifiedApptsRef.current.add(notifKey);
          }
        }
      });
    };

    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status: newStatus });
      fetchAppointments();
    } catch (error) {
      alert("Không thể cập nhật trạng thái");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-status-available-bg text-status-available';
      case 'CONFIRMED': return 'bg-status-confirmed-bg text-status-confirmed';
      case 'CHECKED_IN': return 'bg-status-checked-in-bg text-status-checked-in';
      case 'IN_SERVICE': return 'bg-status-in-service-bg text-status-in-service';
      case 'COMPLETED': return 'bg-status-completed-bg text-status-completed';
      case 'PENDING':
      case 'REQUESTED': return 'bg-status-pending-bg text-status-pending';
      case 'WAITLIST': return 'bg-status-waitlist-bg text-status-waitlist';
      case 'CANCELLED':
      case 'CANCEL_PATIENT':
      case 'CANCEL_CLINIC': return 'bg-status-cancelled-bg text-status-cancelled';
      case 'NO_SHOW': return 'bg-status-no-show-bg text-status-no-show';
      case 'BLOCKED': return 'bg-status-blocked-bg text-status-blocked';
      default: return 'bg-bg-base text-text-main';
    }
  };

  const stats = {
    today: appointments.filter(a => format(new Date(a.startAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length,
    pending: appointments.filter(a => a.status === 'REQUESTED' || a.status === 'PENDING').length,
    checkedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
    newPatients: patients.filter(p => p.createdAt && format(new Date(p.createdAt), 'yyyy-MM') === format(new Date(), 'yyyy-MM')).length,
  };

  const handleScan = async (data: string) => {
    try {
      const parsedData = JSON.parse(data);
      if (parsedData && parsedData.type === 'checkin' && parsedData.id) {
        setShowScanner(false);
        setLoading(true);
        // Automatically mark as checked in
        await api.patch(`/appointments/${parsedData.id}/status`, { status: 'CHECKED_IN' });
        fetchAppointments();
        alert('Check-in thành công!');
      } else {
        alert('Mã QR không hợp lệ!');
      }
    } catch (e) {
      alert('Không thể đọc mã QR. Hãy chắc chắn đây là mã từ vé đặt lịch.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      {showScanner && (
        <QrScanner 
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
      <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-6 shadow-soft print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-inner">
            {clinicProfile?.clinicName ? clinicProfile.clinicName.charAt(0).toUpperCase() : 'D'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-main leading-tight">{clinicProfile?.clinicName || 'Dental Smart'}</h1>
            {clinicProfile?.doctorName && <p className="text-xs text-text-muted font-medium">BS. {clinicProfile.doctorName}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-6 overflow-x-auto whitespace-nowrap scrollbar-hide w-full md:w-auto">
          <nav className="flex space-x-1 md:space-x-2">
            <button 
              onClick={() => setActiveTab('appointments')}
              className={`text-sm font-medium flex items-center px-3 py-4 border-b-2 transition-colors ${activeTab === 'appointments' ? 'text-primary border-primary font-semibold' : 'border-transparent text-text-muted hover:text-text-main'}`}
            >
              <Calendar className="w-4 h-4 mr-1.5 shrink-0" />
              Lịch hẹn
            </button>
            <button 
              onClick={() => setActiveTab('patients')}
              className={`text-sm font-medium flex items-center px-3 py-4 border-b-2 transition-colors ${activeTab === 'patients' ? 'text-primary border-primary font-semibold' : 'border-transparent text-text-muted hover:text-text-main'}`}
            >
              <Users className="w-4 h-4 mr-1.5 shrink-0" />
              Hồ sơ Bệnh án
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={`text-sm font-medium flex items-center px-3 py-4 border-b-2 transition-colors ${activeTab === 'services' ? 'text-primary border-primary font-semibold' : 'border-transparent text-text-muted hover:text-text-main'}`}
            >
              <LayoutList className="w-4 h-4 mr-1.5 shrink-0" />
              Dịch vụ & Lịch
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`text-sm font-medium flex items-center px-3 py-4 border-b-2 transition-colors ${activeTab === 'settings' ? 'text-primary border-primary font-semibold' : 'border-transparent text-text-muted hover:text-text-main'}`}
            >
              <SettingsIcon className="w-4 h-4 mr-1.5 shrink-0" />
              Tài khoản
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`text-sm font-medium flex items-center px-3 py-4 border-b-2 transition-colors ${activeTab === 'analytics' ? 'text-primary border-primary font-semibold' : 'border-transparent text-text-muted hover:text-text-main'}`}
            >
              <BarChart3 className="w-4 h-4 mr-1.5 shrink-0" />
              Báo cáo
            </button>
          </nav>
          <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-border-subtle">
            <button
              type="button"
              onClick={() => {
                const nextVal = !audioEnabled;
                setAudioEnabled(nextVal);
                if (nextVal) {
                  playTTS('Đã kích hoạt trợ lý âm thanh Dental Smart.');
                }
              }}
              className={`text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${
                audioEnabled 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs ring-2 ring-emerald-400/20' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title={audioEnabled ? "Đang bật âm thanh thông báo (Click để tắt)" : "Đang tắt âm thanh (Click để bật đọc giọng nói)"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{audioEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
            </button>
            <button onClick={logout} className="text-sm font-medium text-text-muted hover:text-error flex items-center transition-colors">
              <LogOut className="w-4 h-4 mr-1 shrink-0" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'patients' && <Patients />}
        {activeTab === 'appointments' && (
          <>
            <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-muted">Lịch hẹn hôm nay</h3>
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-text-main">{stats.today}</p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-muted">Bệnh nhân mới</h3>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-text-main">{stats.newPatients}</p>
                <p className="text-[11px] text-text-muted mt-1">Trong tháng này</p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-muted">Chờ xác nhận</h3>
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-soft flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-muted">Đã Check-in</h3>
                  <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-primary">{stats.checkedIn}</p>
              </div>
            </div>

            <div className="rounded-card border border-border-subtle bg-surface shadow-soft overflow-hidden">
              <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-base">
                <div className="flex items-center space-x-4">
                  <h2 className="font-semibold text-text-main">Danh sách lịch hẹn</h2>
                  <div className="flex bg-surface rounded-lg border border-border-subtle p-1 shadow-soft">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                      <LayoutList className="w-4 h-4 mr-2" />
                      Dạng bảng
                    </button>
                    <button 
                      onClick={() => setViewMode('calendar')}
                      className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-slate-100 text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Lịch trực quan
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-btn hover:bg-indigo-700 transition-colors shadow-soft"
                  >
                    <QrCode className="w-4 h-4" />
                    Quét Check-in
                  </button>
                  <button onClick={() => fetchAppointments()} className="text-sm font-medium text-primary hover:underline hidden sm:block">Làm mới</button>
                  {viewMode === 'list' && (
                    <a 
                      href="/booking" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-btn hover:bg-primary-dark transition-colors shadow-soft"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Thêm lịch hẹn mới</span>
                      <span className="sm:hidden">Thêm</span>
                    </a>
                  )}
                </div>
              </div>

              {viewMode === 'calendar' ? (
                <div className="p-4">
                  <CalendarView appointments={appointments} handleUpdateStatus={handleUpdateStatus} refreshAppointments={fetchAppointments} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-text-muted">
                  <thead className="bg-bg-base border-b border-border-subtle text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Khách hàng</th>
                      <th className="px-4 py-3 font-medium">Thời gian</th>
                      <th className="px-4 py-3 font-medium">Dịch vụ</th>
                      <th className="px-4 py-3 font-medium">Bác sĩ</th>
                      <th className="px-4 py-3 font-medium">Trạng thái</th>
                      <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {appointments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-bg-base">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-main">{apt.patientName}</div>
                          <div className="text-xs text-text-muted">{apt.patientPhone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{format(new Date(apt.startAt), 'HH:mm')}</div>
                          <div className="text-xs">{format(new Date(apt.startAt), 'dd/MM/yyyy')}</div>
                        </td>
                        <td className="px-4 py-3">{apt.serviceName}</td>
                        <td className="px-4 py-3">{apt.providerName}</td>
                        <td className="px-4 py-3">
                          
                          <span 
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ 
                              backgroundColor: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.bg || 'var(--bg-muted)', 
                              color: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'var(--text-muted)',
                              border: `1px solid ${APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'transparent'}40`
                            }}
                          >
                            {LABEL_OVERRIDES[apt.status] || APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.label || apt.status}
                          </span>

                        </td>
                                                <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                          {apt.status === 'REQUESTED' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CONFIRMED')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-teal-50 text-teal-700 hover:bg-teal-100 border-transparent hover:border-current/10">Xác Nhận</button>
                          )}
                          {apt.status === 'CONFIRMED' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CHECKED_IN')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-transparent hover:border-current/10">Check-in</button>
                          )}
                          {(apt.status === 'REQUESTED' || apt.status === 'CONFIRMED') && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CANCEL_CLINIC')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-red-50 text-red-700 hover:bg-red-100 border-transparent hover:border-current/10">Hủy Lịch</button>
                          )}
                          {apt.status === 'CHECKED_IN' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'IN_SERVICE')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-purple-50 text-purple-700 hover:bg-purple-100 border-transparent hover:border-current/10">Đang Khám</button>
                          )}
                          {apt.status === 'IN_SERVICE' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-green-50 text-green-700 hover:bg-green-100 border-transparent hover:border-current/10">Hoàn Thành</button>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {appointments.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">Chưa có lịch hẹn nào</td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">Đang tải...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </>
        )}
        {activeTab === 'services' && <ServicesConfig />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Floating Toast Message System (Góc dưới bên phải màn hình) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl flex items-start gap-3 transition-all duration-300 transform animate-in slide-in-from-bottom-5 ${
              t.type === 'new'
                ? 'bg-gradient-to-r from-teal-900 to-slate-900 text-white border-teal-400 shadow-teal-900/30'
                : 'bg-gradient-to-r from-amber-900 to-slate-900 text-white border-amber-400 shadow-amber-900/30'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              t.type === 'new' ? 'bg-teal-700/80 text-teal-200' : 'bg-amber-700/80 text-amber-200'
            }`}>
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  t.type === 'new' ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {t.type === 'new' ? 'Lịch hẹn mới' : 'Sắp đến giờ hẹn'}
                </span>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="text-white/60 hover:text-white p-1 rounded-md transition-colors"
                  aria-label="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="font-bold text-sm text-white mt-1 leading-snug">{t.title}</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
