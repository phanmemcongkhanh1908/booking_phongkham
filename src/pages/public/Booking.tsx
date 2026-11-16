import React, { useEffect, Suspense } from 'react';
import { useBookingStore } from '../../store/booking';
import { useNavigate, Routes, Route, Navigate, useLocation, useParams, Link } from 'react-router-dom';
import { 
  Check, 
  Stethoscope, 
  Phone, 
  ShieldCheck, 
  ShieldAlert,
  Sparkles,
  UserCheck,
  Clock,
  MapPin,
  Navigation
} from 'lucide-react';
import api from '../../services/api';
import { useClinicSettings } from '../../hooks/useClinicSettings';
import { getClinicBasePath, extractCustomClinicSubdomain } from '../../services/clinicResolver';
import { buildGoogleMapsDirectionsUrl, formatClinicSlogan } from '../../utils/maps';
import ServiceSelection from './components/ServiceSelection';
import DateTimeSelection from './components/DateTimeSelection';
import PatientForm from './components/PatientForm';
import BookingConfirmation from './components/BookingConfirmation';
import BookingSummaryCard from './components/BookingSummaryCard';
import MobileSummaryDrawer from './components/MobileSummaryDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import SimpleBookingForm from './components/SimpleBookingForm';

const SuccessView = React.lazy(() => import('./components/SuccessView'));

export default function Booking() {
  const navigate = useNavigate();
  const { slug: routeSlug } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const querySlug = searchParams.get('slug') || searchParams.get('clinic') || searchParams.get('s');
  const slug = (routeSlug || querySlug || '').trim();
  const basePath = getClinicBasePath(slug, location.pathname);
  const isCompact = searchParams.get('compact') === 'true' || window.self !== window.top;

  // Use the dedicated Clinic Settings Service Layer
  const { 
    clinicProfile, 
    businessHours, 
    isCurrentlyOpen, 
    bookingFormConfig,
    announcementBanner 
  } = useClinicSettings(slug);

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
  const selectedServices = useBookingStore(s => s.selectedServices);
  const selectedDate = useBookingStore(s => s.selectedDate);
  const sessionToken = useBookingStore(s => s.sessionToken);
  const patientDraft = useBookingStore(s => s.patientDraft);
  const appointmentId = useBookingStore(s => s.appointmentId);

  // Tự động cuộn lên đầu trang khi chuyển bước (khắc phục lỗi mobile bị giữ cuộn ở cuối trang)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }, 50);

    return () => clearTimeout(timer);
  }, [currentPath, step]);

  const querySearch = location.search || '';
  const isCustomerQrMode = searchParams.get('mode') === 'customer' || searchParams.get('source') === 'qr';
  const customClinicSubdomain = extractCustomClinicSubdomain(
    typeof window !== 'undefined' ? window.location.hostname : ''
  );
  const isClinicPathRoute = Boolean(routeSlug) || /^\/(b|booking|s)\/[^/]+/i.test(location.pathname);
  const isCustomerBookingPortal = Boolean(
    isClinicPathRoute ||
    querySlug ||
    isCustomerQrMode ||
    customClinicSubdomain
  );

  useEffect(() => {
    try {
      if (isCustomerBookingPortal) {
        if (isCustomerQrMode) {
          sessionStorage.setItem('customer_booking_mode', 'true');
        }
      } else {
        sessionStorage.removeItem('customer_booking_mode');
      }
    } catch {}
  }, [isCustomerQrMode, isCustomerBookingPortal]);

  useEffect(() => {
    if (bookingFormConfig?.uiVersion === 'simple') return;

    // Nếu đã hoàn tất đặt lịch (bước 5 / hoan-tat / có appointmentId), tuyệt đối không redirect ngược lại
    if (step === 5 || currentPath === 'hoan-tat' || appointmentId) return;

    const hasService = !!serviceId || (selectedServices && selectedServices.length > 0);

    if (currentPath === 'book' || currentPath === '') {
      navigate(`${basePath}/dich-vu${querySearch}`, { replace: true });
    } else if (step >= 2 && !hasService && currentPath !== 'dich-vu') {
      navigate(`${basePath}/dich-vu${querySearch}`, { replace: true });
    } else if (step >= 3 && step < 5 && (!selectedDate || (!sessionToken && !appointmentId)) && currentPath !== 'chon-gio') {
      navigate(`${basePath}/chon-gio${querySearch}`, { replace: true });
    } else if (step >= 4 && step < 5 && (!patientDraft?.fullName || !patientDraft?.phone) && currentPath !== 'thong-tin') {
      navigate(`${basePath}/thong-tin${querySearch}`, { replace: true });
    }
  }, [currentPath, step, serviceId, selectedServices, selectedDate, sessionToken, patientDraft, appointmentId, navigate, bookingFormConfig?.uiVersion, basePath, querySearch]);

  const clinicDisplayName = clinicProfile?.clinicName || clinicProfile?.name || 'Dental Smart Clinic';
  const doctorDisplayName = clinicProfile?.doctorName ? (
    clinicProfile.doctorName.startsWith('Bs') || clinicProfile.doctorName.startsWith('BS')
      ? clinicProfile.doctorName
      : `BS. ${clinicProfile.doctorName}`
  ) : null;

  useEffect(() => {
    if (doctorDisplayName) {
      document.title = `${clinicDisplayName} - ${doctorDisplayName} | Đặt lịch khám trực tuyến`;
    } else {
      document.title = `${clinicDisplayName} - Đặt lịch khám trực tuyến`;
    }
  }, [clinicDisplayName, doctorDisplayName]);

  // Navigate to step if valid
  const handleStepClick = (targetStep: number) => {
    if (targetStep === 1) {
      setStepStore(1);
      navigate(`${basePath}/dich-vu${querySearch}`);
    } else if (targetStep === 2 && serviceId) {
      setStepStore(2);
      navigate(`${basePath}/chon-gio${querySearch}`);
    } else if (targetStep === 3 && serviceId && selectedDate && sessionToken) {
      setStepStore(3);
      navigate(`${basePath}/thong-tin${querySearch}`);
    } else if (targetStep === 4 && serviceId && selectedDate && sessionToken && patientDraft?.fullName && patientDraft?.phone) {
      setStepStore(4);
      navigate(`${basePath}/xac-nhan${querySearch}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col selection:bg-teal-600/20 antialiased font-sans">
      {/* Top Luxury Healthcare Navigation Header */}
      {!isCompact && (<header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[3.5rem] sm:min-h-[5rem] py-2 sm:py-2.5 flex items-start sm:items-center justify-between gap-3">
          {/* Brand & Clinic Info */}
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-900/15 shrink-0 ring-1 ring-white/20 mt-0.5 sm:mt-0">
              <Stethoscope className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0 flex-1">
              {/* Mobile View: Clean multi-line layout with full hours & clickable address */}
              <div className="sm:hidden min-w-0 space-y-1">
                <h1 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                  {clinicDisplayName}
                </h1>
                {doctorDisplayName ? (
                  <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 leading-tight">
                    <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{doctorDisplayName}</span>
                  </p>
                ) : formatClinicSlogan(clinicProfile?.slogan) ? (
                  <p className="text-[10px] text-teal-800 font-medium italic">
                    “{formatClinicSlogan(clinicProfile?.slogan)}”
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium">
                    Đặt lịch khám trực tuyến
                  </p>
                )}
                {businessHours && (
                  <p className={`inline-flex items-start gap-1 text-[10px] font-bold leading-snug ${
                    isCurrentlyOpen ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    <Clock className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{isCurrentlyOpen ? 'Đang mở cửa' : 'Tạm đóng'} • {businessHours.workingHoursStr}</span>
                  </p>
                )}
                {clinicProfile?.address && (
                  <div>
                    <a
                      href={buildGoogleMapsDirectionsUrl(clinicProfile.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 text-[11px] text-slate-600 hover:text-teal-700 transition-colors leading-snug"
                      title="Nhấn để mở bản đồ chỉ đường tới phòng khám"
                    >
                      <MapPin className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                      <span className="underline decoration-slate-300 underline-offset-2">
                        {clinicProfile.address}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-700 shrink-0 ml-0.5">
                        <Navigation className="w-2.5 h-2.5" />
                        Chỉ đường
                      </span>
                    </a>
                  </div>
                )}
              </div>

              {/* Tablet & Desktop View */}
              <div className="hidden sm:block min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    {clinicDisplayName}
                  </h1>
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/70">
                    <ShieldCheck className="w-3 h-3 text-teal-600" />
                    Y Tế Chuẩn Hóa
                  </span>
                  {doctorDisplayName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bác sĩ phụ trách: <strong className="font-extrabold text-emerald-950">{doctorDisplayName}</strong></span>
                    </span>
                  )}
                  {businessHours && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors whitespace-normal text-left leading-snug ${
                      isCurrentlyOpen 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' 
                        : 'bg-amber-50 text-amber-800 border-amber-200/80'
                    }`} title={businessHours.scheduleSummary}>
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{isCurrentlyOpen ? 'Đang mở cửa' : 'Tạm đóng'} • {businessHours.workingHoursStr}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {clinicProfile?.address && (
                    <a
                      href={buildGoogleMapsDirectionsUrl(clinicProfile.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 text-xs text-slate-600 hover:text-teal-700 transition-colors group"
                      title="Nhấn để mở Google Maps chỉ đường tới phòng khám"
                    >
                      <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span className="leading-snug group-hover:underline underline-offset-2">
                        {clinicProfile.address}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-teal-700 whitespace-nowrap shrink-0">
                        (<Navigation className="w-3 h-3 inline" /> Chỉ đường)
                      </span>
                    </a>
                  )}

                  {formatClinicSlogan(clinicProfile?.slogan) ? (
                    <p className="text-xs text-teal-800 font-medium italic">
                      “{formatClinicSlogan(clinicProfile?.slogan)}”
                    </p>
                  ) : !clinicProfile?.address ? (
                    <p className="text-xs text-slate-500">
                      Hệ thống đặt lịch khám trực tuyến & bảo mật thông tin
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Contact & Admin Access */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {clinicProfile?.phone && (
              <a 
                href={`tel:${clinicProfile.phone}`}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-teal-50 text-teal-900 border border-teal-200/80 hover:bg-teal-100/70 transition-colors shadow-2xs"
                title={`Gọi hotline: ${clinicProfile.phone}`}
              >
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700" />
                <span className="hidden md:inline font-medium">Hotline:</span>
                <span className="font-extrabold hidden sm:inline">{clinicProfile.phone}</span>
              </a>
            )}

            <PWAInstallButton />

            {!isCustomerBookingPortal && (
              <Link
                to="/admin/login"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all shadow-2xs"
                title="Cổng Đăng nhập Quản trị viên"
              >
                <ShieldAlert className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>)}

      {/* Announcement Banner */}
      {announcementBanner?.isVisible && announcementBanner.message && (
        <div className={`overflow-hidden relative z-20 shadow-sm border-b ${
          announcementBanner.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          announcementBanner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="max-w-7xl mx-auto flex items-center h-11 px-3 sm:px-6 lg:px-8">
            <div className="shrink-0 mr-3 flex items-center">
              <Sparkles className={`w-5 h-5 ${
                announcementBanner.type === 'warning' ? 'text-amber-500' :
                announcementBanner.type === 'success' ? 'text-emerald-500' :
                'text-blue-500'
              }`} />
            </div>
            <div className="flex-1 overflow-hidden relative">
              <div className="animate-marquee whitespace-nowrap font-medium text-xs sm:text-sm">
                {announcementBanner.message}
                <span className="inline-block w-8"></span>
                {announcementBanner.message}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 ${isCompact ? "py-2 space-y-3 pb-safe" : "py-4 sm:py-8 space-y-5 sm:space-y-6 pb-24 lg:pb-8"}`}>
        {/* Stepper Progress Ribbon (Visible in Steps 1, 2, 3, 4) - Hidden if Simple Version */}
        {step < 5 && bookingFormConfig?.uiVersion !== 'simple' && (
          <>
            {/* Desktop Full Stepper */}
            {!isCompact && (<div className="hidden sm:block rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm">
              <div className="max-w-3xl mx-auto px-2 sm:px-0">
                <div className="relative flex items-center justify-between">
                  {/* Connector Line Background */}
                  <div className="absolute left-8 right-8 top-5.5 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
                  
                  {/* Active Progress Connector */}
                  <div 
                    className="absolute left-8 top-5.5 -translate-y-1/2 h-1 bg-teal-700 rounded-full transition-all duration-500 ease-out"
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
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${
                            isActive 
                              ? 'bg-teal-700 text-white ring-3 ring-teal-700/20 scale-110 shadow-teal-900/20' 
                              : isCompleted
                                ? 'bg-teal-700 text-white group-hover:bg-teal-800'
                                : 'bg-white text-slate-400 border border-slate-200'
                          }`}
                        >
                          {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : s.id}
                        </div>

                        <div className="text-center mt-2">
                          <span className={`text-sm font-bold block transition-colors ${
                            isActive 
                              ? 'text-teal-950 font-black' 
                              : isCompleted 
                                ? 'text-slate-800 group-hover:text-teal-700' 
                                : 'text-slate-400'
                          }`}>
                            {s.title}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {s.subtitle}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>)}

            {/* Mobile Compact Progress Bar */}
            <div className="sm:hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-0.5">
                    Bước {step}/4
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    {steps.find(s => s.id === step)?.title || 'Đang xử lý'}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">
                    {Math.round(((step) / 4) * 100)}%
                  </div>
                </div>
              </div>
              
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((step) / 4) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}

        {/* Mobile Accordion Summary Drawer (Step 2, 3, 4) - Chỉ hiện khi dùng giao diện Full */}
        {step < 5 && bookingFormConfig?.uiVersion !== 'simple' && <MobileSummaryDrawer currentStep={step} />}

        {/* Dynamic Multi-Column Body */}
        {step < 5 ? (
          bookingFormConfig?.uiVersion === 'simple' ? (
            <SimpleBookingForm />
          ) : (
            <div className="flex flex-col lg:flex-row items-start gap-6 xl:gap-8">
              {/* Primary Interactive View (Left) */}
              <div className="flex-1 w-full min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <Routes>
                  <Route path="dich-vu" element={<ServiceSelection />} />
                  <Route path="chon-gio" element={<DateTimeSelection />} />
                  <Route path="thong-tin" element={<PatientForm />} />
                  <Route path="xac-nhan" element={<BookingConfirmation />} />
                  <Route path="*" element={<Navigate to={`${basePath}/dich-vu${querySearch}`} replace />} />
                </Routes>
              </div>

              {/* Sticky Concierge Summary Sidebar (Right on Desktop) */}
              <div className="hidden lg:block sticky top-28">
                <BookingSummaryCard currentStep={step} />
              </div>
            </div>
          )
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
                <Route path="*" element={<Navigate to={`${basePath}/hoan-tat${querySearch}`} replace />} />
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

      {/* Floating PWA Install Prompt for Mobile */}
      <PWAInstallBanner />
    </div>
  );
}
