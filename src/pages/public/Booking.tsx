import React, { useEffect } from 'react';
import { useBookingStore } from '../../store/booking';
import { Link, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  Check, 
  Stethoscope, 
  Phone, 
  MapPin, 
  Clock, 
  UserCheck, 
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import ServiceSelection from './components/ServiceSelection';
import DateTimeSelection from './components/DateTimeSelection';
import PatientForm from './components/PatientForm';
import SuccessView from './components/SuccessView';
import BookingSummaryCard from './components/BookingSummaryCard';

export default function Booking() {
  const navigate = useNavigate();
  const location = useLocation();

  const clinicProfile = useBookingStore(s => s.clinicProfile);
  const setClinicProfile = useBookingStore(s => s.setClinicProfile);

  const steps = [
    { id: 1, title: 'Dịch vụ', subtitle: 'Lựa chọn điều trị', path: 'dich-vu' },
    { id: 2, title: 'Thời gian', subtitle: 'Chọn ngày & giờ', path: 'chon-gio' },
    { id: 3, title: 'Hồ sơ', subtitle: 'Thông tin tiếp đón', path: 'thong-tin' },
    { id: 4, title: 'Hoàn tất', subtitle: 'Vé khám điện tử', path: 'hoan-tat' }
  ];

  const currentPath = location.pathname.split('/').pop() || '';
  const currentStepObj = steps.find(s => s.path === currentPath);
  const step = currentStepObj ? currentStepObj.id : 1;

  const serviceId = useBookingStore(s => s.serviceId);
  const selectedDate = useBookingStore(s => s.selectedDate);

  useEffect(() => {
    // Tải cấu hình thông tin phòng khám
    api.get('/public/clinic-info')
      .then(res => {
        if (res.data?.data?.clinicProfile) {
          setClinicProfile(res.data.data.clinicProfile);
        }
      })
      .catch(console.error);
  }, [setClinicProfile]);

  useEffect(() => {
    if (currentPath === 'book' || currentPath === '') {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 2 && !serviceId) {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 3 && !selectedDate) {
      navigate('/book/chon-gio', { replace: true });
    }
  }, [currentPath, step, serviceId, selectedDate, navigate]);

  const hasCustomClinic = Boolean(
    clinicProfile?.clinicName && 
    clinicProfile.clinicName.trim() &&
    clinicProfile.clinicName.trim().toLowerCase() !== 'dental smart'
  );

  const clinicDisplayName = hasCustomClinic && clinicProfile?.clinicName 
    ? clinicProfile.clinicName 
    : 'Dental Smart Clinic';

  useEffect(() => {
    document.title = `${clinicDisplayName} - Đặt lịch khám trực tuyến`;
  }, [clinicDisplayName]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col selection:bg-teal-600/20 antialiased font-sans">
      {/* Top Luxury Healthcare Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand & Clinic Info */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-900/15 shrink-0">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                  {clinicDisplayName}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                  <ShieldCheck className="w-3 h-3" />
                  Y Tế Chuẩn Hóa
                </span>
              </div>
              
              {clinicProfile?.slogan ? (
                <p className="text-xs text-teal-700 font-medium italic truncate hidden sm:block">
                  “{clinicProfile.slogan}”
                </p>
              ) : (
                <p className="text-xs text-slate-500 truncate hidden sm:block">
                  Hệ thống đặt lịch khám trực tuyến & bảo mật thông tin
                </p>
              )}
            </div>
          </div>

          {/* Quick Contact & Admin Access */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {clinicProfile?.phone && (
              <a 
                href={`tel:${clinicProfile.phone}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100/70 transition-colors shadow-2xs"
                title="Gọi hotline tư vấn"
              >
                <Phone className="w-4 h-4 text-teal-600" />
                <span className="hidden sm:inline">Hotline:</span>
                <span>{clinicProfile.phone}</span>
              </a>
            )}

            <Link
              to="/admin/login"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all shadow-2xs"
              title="Cổng Đăng nhập Quản trị viên"
            >
              <ShieldAlert className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Stepper Progress Ribbon (Visible in Steps 1, 2, 3) */}
        {step < 4 && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
            <div className="max-w-2xl mx-auto">
              <div className="relative flex items-center justify-between">
                {/* Connector Line Background */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
                
                {/* Active Progress Connector */}
                <div 
                  className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-teal-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(0, ((step - 1) / 2) * 100)}%` }}
                />

                {steps.slice(0, 3).map((s) => {
                  const isActive = step === s.id;
                  const isCompleted = step > s.id;

                  return (
                    <div key={s.id} className="relative z-10 flex flex-col items-center group">
                      <div 
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 shadow-sm ${
                          isActive 
                            ? 'bg-teal-700 text-white ring-4 ring-teal-600/20 scale-110 shadow-teal-900/20' 
                            : isCompleted
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-slate-400 border border-slate-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s.id}
                      </div>

                      <div className="text-center mt-2">
                        <span className={`text-xs sm:text-sm font-bold block transition-colors ${
                          isActive ? 'text-teal-900' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                        }`}>
                          {s.title}
                        </span>
                        <span className="text-[10px] text-slate-400 hidden sm:block">
                          {s.subtitle}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Multi-Column Body */}
        {step < 4 ? (
          <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8">
            {/* Primary Interactive View (Left) */}
            <div className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <Routes>
                <Route path="dich-vu" element={<ServiceSelection />} />
                <Route path="chon-gio" element={<DateTimeSelection />} />
                <Route path="thong-tin" element={<PatientForm />} />
                <Route path="*" element={<Navigate to="dich-vu" replace />} />
              </Routes>
            </div>

            {/* Sticky Concierge Summary Sidebar (Right on Desktop / Tablet) */}
            <div className="hidden lg:block sticky top-28">
              <BookingSummaryCard currentStep={step} />
            </div>
          </div>
        ) : (
          /* Step 4: Success View (Centered E-Ticket & Confirmation Hub) */
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <Routes>
              <Route path="hoan-tat" element={<SuccessView />} />
              <Route path="*" element={<Navigate to="hoan-tat" replace />} />
            </Routes>
          </div>
        )}
      </main>

      {/* Refined Medical Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2 text-slate-600 font-semibold">
          <span>{clinicDisplayName}</span>
          <span>•</span>
          <span>Hệ thống Đặt Hẹn Nha Khoa Thông Minh Dental Smart</span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
          Mọi thông tin cá nhân và bệnh án được mã hóa và bảo mật theo chuẩn y khoa. Cần hỗ trợ khẩn cấp, vui lòng liên hệ hotline phòng khám.
        </p>
      </footer>
    </div>
  );
}
