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
import GoogleBackupWarningBanner from '../../components/admin/GoogleBackupWarningBanner';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { LayoutList, Calendar, BarChart3, Users, CalendarPlus, QrCode, Settings as SettingsIcon, LogOut, UserPlus, Clock, CheckCircle, Bell, BellOff, Volume2, VolumeX, X, ShieldAlert, Cloud, PhoneCall, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const logout = useAuthStore((state) => state.logout);
  const { isConnected, init: initGoogleAuth } = useGoogleAuthStore();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  const [activeTab, setActiveTab] = useState<'appointments' | 'patients' | 'settings' | 'services' | 'analytics'>('appointments');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TODAY' | 'PENDING' | 'CHECKED_IN' | 'COMPLETED'>('ALL');
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
    const unsub = initGoogleAuth();
    api.get('/admin/settings').then(res => {
      if (res.data.data && res.data.data.clinicProfile) {
        setClinicProfile(res.data.data.clinicProfile);
      }
    }).catch(console.error);
    return () => unsub();
  }, [initGoogleAuth]);


  
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

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const currentMonthStr = format(new Date(), 'yyyy-MM');

  const stats = {
    today: appointments.filter(a => {
      if (!a.startAt) return false;
      const d = new Date(a.startAt);
      return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === todayStr;
    }).length,
    pending: appointments.filter(a => a.status === 'REQUESTED' || a.status === 'PENDING').length,
    checkedIn: appointments.filter(a => a.status === 'CHECKED_IN').length,
    completed: appointments.filter(a => a.status === 'COMPLETED').length,
    newPatients: patients.filter(p => {
      if (!p.createdAt) return true; // Fallback: consider created in active period
      const d = new Date(p.createdAt);
      return !isNaN(d.getTime()) && format(d, 'yyyy-MM') === currentMonthStr;
    }).length,
  };

  const displayedAppointments = appointments.filter(apt => {
    if (statusFilter === 'TODAY') {
      if (!apt.startAt) return false;
      const d = new Date(apt.startAt);
      return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === todayStr;
    }
    if (statusFilter === 'PENDING') {
      return apt.status === 'REQUESTED' || apt.status === 'PENDING';
    }
    if (statusFilter === 'CHECKED_IN') {
      return apt.status === 'CHECKED_IN';
    }
    if (statusFilter === 'COMPLETED') {
      return apt.status === 'COMPLETED';
    }
    return true;
  });

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
      {/* Admin Responsive Header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border-subtle shadow-xs print:hidden">
        {/* Top Tier: Brand, Navigation & Actions */}
        <div className="flex h-14 sm:h-16 items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center text-white font-extrabold text-base sm:text-xl shadow-inner shrink-0">
              {clinicProfile?.clinicName ? clinicProfile.clinicName.charAt(0).toUpperCase() : 'D'}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-extrabold text-text-main leading-tight truncate">
                {clinicProfile?.clinicName || 'Dental Smart'}
              </h1>
              {clinicProfile?.doctorName && (
                <p className="text-[11px] sm:text-xs text-text-muted font-medium truncate">
                  BS. {clinicProfile.doctorName}
                </p>
              )}
            </div>
          </div>

          {/* Desktop Navigation (md and up) */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <button 
              onClick={() => setActiveTab('appointments')}
              className={`text-sm font-medium flex items-center px-3 py-2 rounded-xl transition-all ${
                activeTab === 'appointments' 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5 shrink-0" />
              Lịch hẹn
            </button>
            <button 
              onClick={() => setActiveTab('patients')}
              className={`text-sm font-medium flex items-center px-3 py-2 rounded-xl transition-all ${
                activeTab === 'patients' 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 mr-1.5 shrink-0" />
              Hồ sơ Bệnh án
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={`text-sm font-medium flex items-center px-3 py-2 rounded-xl transition-all ${
                activeTab === 'services' 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <LayoutList className="w-4 h-4 mr-1.5 shrink-0" />
              Dịch vụ & Lịch
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`text-sm font-medium flex items-center px-3 py-2 rounded-xl transition-all ${
                activeTab === 'analytics' 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1.5 shrink-0" />
              Báo cáo
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`text-sm font-medium flex items-center px-3 py-2 rounded-xl transition-all ${
                activeTab === 'settings' 
                  ? 'bg-primary/10 text-primary font-bold' 
                  : 'text-text-muted hover:text-text-main hover:bg-slate-100'
              }`}
            >
              <SettingsIcon className="w-4 h-4 mr-1.5 shrink-0" />
              Tài khoản
            </button>
          </nav>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Google Status Badge (Desktop only) */}
            {!isConnected ? (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-all shadow-2xs"
                title="Cảnh báo: Chưa kết nối Google Drive & Sheets để sao lưu dự phòng (Click để cấu hình)"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Chưa kết nối Google</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all"
                title="Dữ liệu đã được bảo vệ với Google Drive & Sheets (Click để xem chi tiết)"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google: Đã bảo vệ</span>
              </button>
            )}

            {/* Mobile QR Scanner shortcut */}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="md:hidden p-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
              title="Quét mã QR Check-in"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Voice Audio Assistant Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextVal = !audioEnabled;
                setAudioEnabled(nextVal);
                if (nextVal) {
                  playTTS('Đã kích hoạt trợ lý âm thanh Dental Smart.');
                }
              }}
              className={`text-xs font-semibold flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all border ${
                audioEnabled 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs ring-2 ring-emerald-400/20' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title={audioEnabled ? "Đang bật âm thanh thông báo (Click để tắt)" : "Đang tắt âm thanh (Click để bật đọc giọng nói)"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{audioEnabled ? 'Âm thanh' : 'Âm thanh'}</span>
            </button>

            {/* Logout */}
            <button 
              onClick={logout} 
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-medium text-text-muted hover:text-red-600 hover:bg-red-50 rounded-xl flex items-center transition-colors"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4 sm:mr-1 shrink-0" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Horizontal Tab Bar on Mobile & Tablet (< md) */}
        <div className="md:hidden relative border-t border-slate-200/60 bg-slate-50/70">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-3.5 py-2 pr-8">
            <button 
              onClick={() => setActiveTab('appointments')}
            className={`text-xs font-bold flex items-center px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'appointments' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Lịch hẹn
          </button>
          <button 
            onClick={() => setActiveTab('patients')}
            className={`text-xs font-bold flex items-center px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'patients' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
            }`}
          >
            <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Hồ sơ Bệnh án
          </button>
          <button 
            onClick={() => setActiveTab('services')}
            className={`text-xs font-bold flex items-center px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'services' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Dịch vụ & Lịch
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`text-xs font-bold flex items-center px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'analytics' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Báo cáo
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`text-xs font-bold flex items-center px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'settings' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Tài khoản
          </button>
          </div>
          {/* Scroll Indicator */}
          <div className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-end pr-1.5 bg-gradient-to-l from-slate-50/90 to-transparent pointer-events-none">
            <ChevronRight className="w-4 h-4 text-slate-400 animate-pulse" />
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-3.5 sm:p-6 max-w-7xl mx-auto w-full">
        <GoogleBackupWarningBanner 
          onNavigateToSettings={() => setActiveTab('settings')} 
          appointments={appointments}
          onAppointmentsSynced={() => fetchAppointments(false)}
        />
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'patients' && <Patients />}
        {activeTab === 'appointments' && (
          <>
            <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'TODAY' ? 'ALL' : 'TODAY')}
                className={`text-left rounded-2xl border bg-surface p-3.5 sm:p-5 shadow-soft flex flex-col justify-between transition-all cursor-pointer hover:border-blue-300 ${
                  statusFilter === 'TODAY' 
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' 
                    : 'border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-text-muted">Lịch hẹn hôm nay</h3>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-text-main leading-tight">{stats.today}</p>
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-muted">Tổng: {appointments.length}</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-text-muted mt-1">Ngày {format(new Date(), 'dd/MM/yyyy')}</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('patients')}
                className="text-left rounded-2xl border border-border-subtle bg-surface p-3.5 sm:p-5 shadow-soft flex flex-col justify-between transition-all cursor-pointer hover:border-emerald-300"
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-text-muted">Bệnh nhân mới</h3>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-text-main leading-tight">{stats.newPatients}</p>
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-muted">Xem DS &rarr;</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-text-muted mt-1">Tháng {format(new Date(), 'MM/yyyy')}</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'PENDING' ? 'ALL' : 'PENDING')}
                className={`text-left rounded-2xl border bg-surface p-3.5 sm:p-5 shadow-soft flex flex-col justify-between transition-all cursor-pointer hover:border-amber-300 ${
                  statusFilter === 'PENDING' 
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' 
                    : 'border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-text-muted">Chờ xác nhận</h3>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 leading-tight">{stats.pending}</p>
                  {stats.pending > 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Cần duyệt</span>}
                </div>
                <p className="text-[10px] sm:text-[11px] text-text-muted mt-1">Lịch chờ tiếp nhận</p>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(prev => prev === 'CHECKED_IN' ? 'ALL' : 'CHECKED_IN')}
                className={`text-left rounded-2xl border bg-surface p-3.5 sm:p-5 shadow-soft flex flex-col justify-between transition-all cursor-pointer hover:border-teal-300 ${
                  statusFilter === 'CHECKED_IN' 
                    ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/10' 
                    : 'border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-text-muted">Đã Check-in</h3>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">{stats.checkedIn}</p>
                  {stats.checkedIn > 0 && <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">Tại phòng</span>}
                </div>
                <p className="text-[10px] sm:text-[11px] text-text-muted mt-1">Bệnh nhân đã đến</p>
              </button>
            </div>

            <div className="rounded-2xl sm:rounded-card border border-border-subtle bg-surface shadow-soft overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-base">
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
                  <h2 className="font-bold text-text-main text-base sm:text-lg whitespace-nowrap">Danh sách lịch hẹn</h2>
                  <div className="flex bg-surface rounded-xl border border-border-subtle p-0.5 sm:p-1 shadow-2xs">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`flex items-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        viewMode === 'list' 
                          ? 'bg-slate-100 text-text-main shadow-2xs' 
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />
                      Dạng bảng
                    </button>
                    <button 
                      onClick={() => setViewMode('calendar')}
                      className={`flex items-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        viewMode === 'calendar' 
                          ? 'bg-slate-100 text-text-main shadow-2xs' 
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 shrink-0" />
                      Lịch trực quan
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-2xs"
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>Quét Check-in</span>
                  </button>
                  <button 
                    onClick={() => fetchAppointments()} 
                    className="text-xs sm:text-sm font-semibold text-primary hover:underline px-2 py-1.5"
                  >
                    Làm mới
                  </button>
                  {viewMode === 'list' && (
                    <a 
                      href="/book" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-teal-800 transition-colors shadow-2xs ml-auto sm:ml-0"
                    >
                      <CalendarPlus className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Thêm lịch hẹn mới</span>
                      <span className="sm:hidden">Đặt hẹn</span>
                    </a>
                  )}
                </div>
              </div>

              {viewMode === 'calendar' ? (
                <div className="p-2.5 sm:p-4">
                  <CalendarView appointments={appointments} handleUpdateStatus={handleUpdateStatus} refreshAppointments={fetchAppointments} />
                </div>
              ) : (
                <>
                  {/* Quick Status Filter Tabs */}
                  <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-b border-border-subtle flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-xs font-bold text-text-muted mr-1 shrink-0">Lọc:</span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'bg-white text-text-muted hover:text-text-main border border-border-subtle'
                      }`}
                    >
                      Tất cả ({appointments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('TODAY')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'TODAY'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                      }`}
                    >
                      Hôm nay ({stats.today})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('PENDING')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'PENDING'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                      }`}
                    >
                      Chờ xác nhận ({stats.pending})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('CHECKED_IN')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'CHECKED_IN'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200'
                      }`}
                    >
                      Đã Check-in ({stats.checkedIn})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('COMPLETED')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'COMPLETED'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      Hoàn thành ({stats.completed})
                    </button>
                  </div>

                  {/* Mobile Card View (visible on mobile < md) */}
                  <div className="block md:hidden divide-y divide-slate-100">
                    {displayedAppointments.map((apt) => (
                      <div key={apt.id} className="p-3.5 space-y-2.5 bg-surface hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <h4 className="font-bold text-text-main text-sm truncate">{apt.patientName}</h4>
                            {apt.patientPhone && (
                              <a 
                                href={`tel:${apt.patientPhone}`} 
                                className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                              >
                                <PhoneCall className="w-3 h-3 shrink-0" />
                                {apt.patientPhone}
                              </a>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-text-main text-xs sm:text-sm">
                              {format(new Date(apt.startAt), 'HH:mm')}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-text-muted">
                              {format(new Date(apt.startAt), 'dd/MM/yyyy')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-text-muted truncate min-w-0">
                            <span className="font-medium text-text-main truncate">{apt.serviceName}</span>
                            {apt.providerName && (
                              <>
                                <span>•</span>
                                <span className="truncate">{apt.providerName}</span>
                              </>
                            )}
                          </div>
                          <span 
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold shrink-0"
                            style={{ 
                              backgroundColor: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.bg || 'var(--bg-muted)', 
                              color: APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'var(--text-muted)',
                              border: `1px solid ${APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.color || 'transparent'}40`
                            }}
                          >
                            {LABEL_OVERRIDES[apt.status] || APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES]?.label || apt.status}
                          </span>
                        </div>

                        {/* Action buttons on mobile */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                          {apt.status === 'REQUESTED' && (
                            <button 
                              onClick={() => handleUpdateStatus(apt.id, 'CONFIRMED')} 
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/60 shadow-2xs text-center min-h-[36px]"
                            >
                              Xác Nhận
                            </button>
                          )}
                          {apt.status === 'CONFIRMED' && (
                            <button 
                              onClick={() => handleUpdateStatus(apt.id, 'CHECKED_IN')} 
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 shadow-2xs text-center min-h-[36px]"
                            >
                              Check-in
                            </button>
                          )}
                          {(apt.status === 'REQUESTED' || apt.status === 'CONFIRMED') && (
                            <button 
                              onClick={() => handleUpdateStatus(apt.id, 'CANCEL_CLINIC')} 
                              className="py-1.5 px-3 rounded-xl text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60 shadow-2xs text-center min-h-[36px]"
                            >
                              Hủy Lịch
                            </button>
                          )}
                          {apt.status === 'CHECKED_IN' && (
                            <button 
                              onClick={() => handleUpdateStatus(apt.id, 'IN_SERVICE')} 
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60 shadow-2xs text-center min-h-[36px]"
                            >
                              Đang Khám
                            </button>
                          )}
                          {apt.status === 'IN_SERVICE' && (
                            <button 
                              onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')} 
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 shadow-2xs text-center min-h-[36px]"
                            >
                              Hoàn Thành
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {displayedAppointments.length === 0 && !loading && (
                      <div className="p-8 text-center text-text-muted text-sm space-y-2">
                        <p>
                          {statusFilter === 'TODAY'
                            ? `Không có lịch hẹn nào trong ngày hôm nay (${format(new Date(), 'dd/MM/yyyy')}).`
                            : statusFilter === 'PENDING'
                            ? 'Không có lịch hẹn nào đang chờ xác nhận.'
                            : statusFilter === 'CHECKED_IN'
                            ? 'Không có lịch hẹn nào đang Check-in.'
                            : statusFilter === 'COMPLETED'
                            ? 'Chưa có lịch hẹn nào hoàn thành.'
                            : 'Chưa có lịch hẹn nào trong danh sách.'}
                        </p>
                        {statusFilter !== 'ALL' && appointments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setStatusFilter('ALL')}
                            className="text-xs font-bold text-primary hover:underline cursor-pointer"
                          >
                            Xem tất cả ({appointments.length} lịch hẹn)
                          </button>
                        )}
                      </div>
                    )}
                    {loading && (
                      <div className="p-8 text-center text-text-muted text-sm">
                        Đang tải danh sách lịch hẹn...
                      </div>
                    )}
                  </div>

                  {/* Desktop Table View (visible on md and up) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-muted min-w-[720px]">
                      <thead className="bg-bg-base border-b border-border-subtle text-text-muted">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Khách hàng</th>
                          <th className="px-4 py-3 font-semibold">Thời gian</th>
                          <th className="px-4 py-3 font-semibold">Dịch vụ</th>
                          <th className="px-4 py-3 font-semibold">Bác sĩ</th>
                          <th className="px-4 py-3 font-semibold">Trạng thái</th>
                          <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {displayedAppointments.map((apt) => (
                          <tr key={apt.id} className="hover:bg-bg-base transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-text-main">{apt.patientName}</div>
                              <div className="text-xs text-text-muted">{apt.patientPhone}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-text-main">{format(new Date(apt.startAt), 'HH:mm')}</div>
                              <div className="text-xs text-text-muted">{format(new Date(apt.startAt), 'dd/MM/yyyy')}</div>
                            </td>
                            <td className="px-4 py-3 text-text-main">{apt.serviceName}</td>
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
                        {displayedAppointments.length === 0 && !loading && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                              <div className="space-y-1.5">
                                <p>
                                  {statusFilter === 'TODAY'
                                    ? `Không có lịch hẹn nào trong ngày hôm nay (${format(new Date(), 'dd/MM/yyyy')}).`
                                    : statusFilter === 'PENDING'
                                    ? 'Không có lịch hẹn nào đang chờ xác nhận.'
                                    : statusFilter === 'CHECKED_IN'
                                    ? 'Không có lịch hẹn nào đang Check-in.'
                                    : statusFilter === 'COMPLETED'
                                    ? 'Chưa có lịch hẹn nào hoàn thành.'
                                    : 'Chưa có lịch hẹn nào trong danh sách.'}
                                </p>
                                {statusFilter !== 'ALL' && appointments.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setStatusFilter('ALL')}
                                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                  >
                                    Xem tất cả ({appointments.length} lịch hẹn)
                                  </button>
                                )}
                              </div>
                            </td>
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
                </>
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
