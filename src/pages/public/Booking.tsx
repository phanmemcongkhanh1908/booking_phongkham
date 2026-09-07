import React, { useEffect, Suspense } from 'react';
import { useBookingStore } from '../../store/booking';
import { Link, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  Check, 
  Stethoscope, 
  Phone, 
  ShieldCheck, 
  ChevronRight, 
  Sparkles 
} from 'lucide-react';
import api from '../../services/api';
import ServiceSelection from './components/ServiceSelection';
import DateTimeSelection from './components/DateTimeSelection';
import PatientForm from './components/PatientForm';
import BookingConfirmation from './components/BookingConfirmation';
import BookingSummaryCard from './components/BookingSummaryCard';
import MobileSummaryDrawer from './components/MobileSummaryDrawer';

const SuccessView = React.lazy(() => import('./components/SuccessView'));

export default function Booking() {
  const navigate = useNavigate();
  const location = useLocation();

  const clinicProfile = useBookingStore(s => s.clinicProfile);
  const setClinicProfile = useBookingStore(s => s.setClinicProfile);
  const setBookingFormConfig = useBookingStore(s => s.setBookingFormConfig);
  const setStepStore = useBookingStore(s => s.setStep);

  const steps = [
    { id: 1, title: 'Dịch vụ', subtitle: 'Lựa chọn điều trị', path: 'dich-vu' },
    { id: 2, title: 'Thời gian', subtitle: 'Chọn ngày & giờ', path: 'chon-gio' },
    { id: 3, title: 'Hồ sơ', subtitle: 'Thông tin tiếp đón', path: 'thong-tin' },
    { id: 4, title: 'Kiểm tra', subtitle: 'Đối chiếu thông tin', path: 'xac-nhan' },
    { id: 5, title: 'Hoàn tất', subtitle: 'Vé khám điện tử', path: 'hoan-tat' }
  ];

  const currentPath = location.pathname.split('/').pop() || '';
  const currentStepObj = steps.find(s => s.path === currentPath);
  const step = currentStepObj ? currentStepObj.id : 1;

  const serviceId = useBookingStore(s => s.serviceId);
  const selectedDate = useBookingStore(s => s.selectedDate);
  const sessionToken = useBookingStore(s => s.sessionToken);
  const patientDraft = useBookingStore(s => s.patientDraft);

  useEffect(() => {
    // Tải cấu hình thông tin phòng khám & hồ sơ tiếp đón
    api.get('/public/clinic-info')
      .then(res => {
        if (res.data?.data?.clinicProfile) {
          setClinicProfile(res.data.data.clinicProfile);
        }
        if (res.data?.data?.bookingFormConfig) {
          setBookingFormConfig(res.data.data.bookingFormConfig);
        }
      })
      .catch(console.error);
  }, [setClinicProfile, setBookingFormConfig]);

  useEffect(() => {
    if (currentPath === 'book' || currentPath === '') {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 2 && !serviceId) {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 3 && (!selectedDate || !sessionToken)) {
      navigate('/book/chon-gio', { replace: true });
    } else if (step >= 4 && step < 5 && (!patientDraft?.fullName || !patientDraft?.phone)) {
      navigate('/book/thong-tin', { replace: true });
    }
  }, [currentPath, step, serviceId, selectedDate, sessionToken, patientDraft, navigate]);

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

  // Navigate to step if valid
  const handleStepClick = (targetStep: number) => {
    if (targetStep === 1) {
      setStepStore(1);
      navigate('/book/dich-vu');
    } else if (targetStep === 2 && serviceId) {
      setStepStore(2);
      navigate('/book/chon-gio');
    } else if (targetStep === 3 && serviceId && selectedDate && sessionToken) {
      setStepStore(3);
      navigate('/book/thong-tin');
    } else if (targetStep === 4 && serviceId && selectedDate && sessionToken && patientDraft?.fullName && patientDraft?.phone) {
      setStepStore(4);
      navigate('/book/xac-nhan');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col selection:bg-teal-600/20 antialiased font-sans">
      {/* Top Luxury Healthcare Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand & Clinic Info */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-900/15 shrink-0 ring-1 ring-white/20">
              <Stethoscope className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-xl font-black text-slate-900 tracking-tight truncate">
                  {clinicDisplayName}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/70">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  Y Tế Chuẩn Hóa
                </span>
              </div>
              
              {clinicProfile?.slogan ? (
                <p className="text-xs text-teal-800 font-medium italic truncate hidden sm:block">
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {clinicProfile?.phone && (
              <a 
                href={`tel:${clinicProfile.phone}`}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-teal-50 text-teal-900 border border-teal-200/80 hover:bg-teal-100/70 transition-colors shadow-2xs"
                title="Gọi hotline tư vấn y khoa"
              >
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700" />
                <span className="hidden md:inline font-medium">Hotline:</span>
                <span className="font-extrabold">{clinicProfile.phone}</span>
              </a>
            )}

            <Link
              to="/admin/login"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all shadow-2xs"
              title="Cổng Đăng nhập Quản trị viên"
            >
              <ShieldAlert className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">
        {/* Stepper Progress Ribbon (Visible in Steps 1, 2, 3, 4) */}
        {step < 5 && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-center justify-between">
                {/* Connector Line Background */}
                <div className="absolute left-5 right-5 sm:left-8 sm:right-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
                
                {/* Active Progress Connector */}
                <div 
                  className="absolute left-5 sm:left-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-teal-700 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, ((step - 1) / 3) * 92))}%` }}
                />

                {steps.slice(0, 4).map((s) => {
                  const isActive = step === s.id;
                  const isCompleted = step > s.id;
                  const isClickable = s.id < step || 
                    (s.id === 2 && Boolean(serviceId)) ||
                    (s.id === 3 && Boolean(serviceId && selectedDate && sessionToken)) ||
                    (s.id === 4 && Boolean(serviceId && selectedDate && sessionToken && patientDraft?.fullName && patientDraft?.phone));

                  return (
                    <div 
                      key={s.id} 
                      onClick={() => isClickable && handleStepClick(s.id)}
                      className={`relative z-10 flex flex-col items-center select-none ${
                        isClickable ? 'cursor-pointer group' : 'cursor-default'
                      }`}
                    >
                      <div 
                        className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 shadow-sm ${
                          isActive 
                            ? 'bg-teal-700 text-white ring-3 ring-teal-700/20 scale-105 sm:scale-110 shadow-teal-900/20' 
                            : isCompleted
                              ? 'bg-teal-700 text-white group-hover:bg-teal-800'
                              : 'bg-white text-slate-400 border border-slate-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : s.id}
                      </div>

                      <div className="text-center mt-1.5 sm:mt-2">
                        <span className={`text-[11px] sm:text-sm font-bold block transition-colors ${
                          isActive 
                            ? 'text-teal-950 font-black' 
                            : isCompleted 
                              ? 'text-slate-800 group-hover:text-teal-700' 
                              : 'text-slate-400'
                        }`}>
                          {s.title}
                        </span>
                        <span className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
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

        {/* Mobile Accordion Summary Drawer (Step 2, 3, 4) */}
        {step < 5 && <MobileSummaryDrawer currentStep={step} />}

        {/* Dynamic Multi-Column Body */}
        {step < 5 ? (
          <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8">
            {/* Primary Interactive View (Left) */}
            <div className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <Routes>
                <Route path="dich-vu" element={<ServiceSelection />} />
                <Route path="chon-gio" element={<DateTimeSelection />} />
                <Route path="thong-tin" element={<PatientForm />} />
                <Route path="xac-nhan" element={<BookingConfirmation />} />
                <Route path="*" element={<Navigate to="dich-vu" replace />} />
              </Routes>
            </div>

            {/* Sticky Concierge Summary Sidebar (Right on Desktop) */}
            <div className="hidden lg:block sticky top-28">
              <BookingSummaryCard currentStep={step} />
            </div>
          </div>
        ) : (
          /* Step 5: Success View (Centered E-Ticket & Confirmation Hub) with Lazy Loading */
          <Suspense fallback={
            <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-lg flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-teal-700/30 border-t-teal-700 rounded-full animate-spin" />
              <p className="text-slate-600 font-semibold text-sm">Đang tải thông tin vé khám điện tử...</p>
            </div>
          }>
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <Routes>
                <Route path="hoan-tat" element={<SuccessView />} />
                <Route path="*" element={<Navigate to="hoan-tat" replace />} />
              </Routes>
            </div>
          </Suspense>
        )}
      </main>

      {/* Refined Medical Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <div className="flex flex-wrap items-center justify-center gap-2 text-slate-700 font-semibold">
          <span>{clinicDisplayName}</span>
          <span className="text-slate-300">•</span>
          <span>Hệ thống Đặt Hẹn Nha Khoa Trực Tuyến Dental Smart</span>
        </div>
        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
          Mọi thông tin cá nhân và bệnh án được mã hóa và bảo mật theo quy chế bảo vệ dữ liệu y tế. Cần hỗ trợ khẩn cấp, vui lòng liên hệ hotline phòng khám.
        </p>
      </footer>
    </div>
  );
}
