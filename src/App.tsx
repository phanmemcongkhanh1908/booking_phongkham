import React, { Component, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import NotificationManager from './components/NotificationManager';
import { NetworkStatusNotification } from './components/NetworkStatusNotification';

// Dynamic import with retry to protect against network hiccups or stale chunk cache
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('Dynamic import failed, retrying once...', error);
      // Wait a small tick before retry
      await new Promise((r) => setTimeout(r, 800));
      try {
        return await componentImport();
      } catch (retryError) {
        console.error('Dynamic import retry failed:', retryError);
        // Force reload page if chunk was stale/purged during redeploy
        const hasReloaded = sessionStorage.getItem('chunk_retry_reload');
        if (!hasReloaded) {
          sessionStorage.setItem('chunk_retry_reload', 'true');
          window.location.reload();
        }
        throw retryError;
      }
    }
  });
}

// Lazy loading pages with retry
const PublicBooking = lazyWithRetry(() => import('./pages/public/Booking'));
const MyBooking = lazyWithRetry(() => import('./pages/public/MyBooking'));
const Login = lazyWithRetry(() => import('./pages/admin/Login'));
const Dashboard = lazyWithRetry(() => import('./pages/admin/Dashboard'));

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('App-level ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 text-slate-800">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Đang tải lại giao diện</h2>
            <p className="text-sm text-slate-600">
              Hệ thống vừa cập nhật phiên bản mới hoặc mạng kết nối chậm. Vui lòng nhấn nút bên dưới để tải lại.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk_retry_reload');
                window.location.reload();
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition shadow-sm w-full cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    const savedAdminSlug = typeof window !== 'undefined' ? localStorage.getItem('last_admin_slug') : null;
    const isAdminPwa = typeof window !== 'undefined' && localStorage.getItem('pwa_admin_mode') === '1';
    if (isAdminPwa && savedAdminSlug) {
      return <Navigate to={`/b/${savedAdminSlug}/login`} replace />;
    }
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

const RootEntryRedirect = () => {
  const token = useAuthStore((state) => state.token);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  const isAdminPwa = typeof window !== 'undefined' && localStorage.getItem('pwa_admin_mode') === '1';

  if (isStandalone && (isAdminPwa || token)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/book" replace />;
};

// Global scroll to top on route change (solves mobile remaining scrolled to bottom)
function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }, 30);

    return () => clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NetworkStatusNotification />
        <ScrollToTop />
        <NotificationManager />
        <React.Suspense
          fallback={
            <div className="flex h-screen items-center justify-center text-slate-500 gap-2">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang tải...</span>
            </div>
          }
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<RootEntryRedirect />} />
            
            {/* Dedicated Clinic Admin Login Routes */}
            <Route path="/b/:slug/login" element={<Login />} />
            <Route path="/b/:slug/admin" element={<Login />} />
            <Route path="/booking/:slug/login" element={<Login />} />
            <Route path="/booking/:slug/admin" element={<Login />} />
            <Route path="/admin/login" element={<Login />} />

            {/* Dedicated Clinic Patient Appointment Lookup Routes */}
            <Route path="/b/:slug/lich-hen" element={<MyBooking />} />
            <Route path="/b/:slug/lich-hen-cua-toi" element={<MyBooking />} />
            <Route path="/booking/:slug/lich-hen" element={<MyBooking />} />
            <Route path="/booking/:slug/lich-hen-cua-toi" element={<MyBooking />} />
            <Route path="/s/:slug/lich-hen" element={<MyBooking />} />
            <Route path="/s/:slug/lich-hen-cua-toi" element={<MyBooking />} />

            <Route path="/book/*" element={<PublicBooking />} />
            <Route path="/booking/:slug/*" element={<PublicBooking />} />
            <Route path="/b/:slug/*" element={<PublicBooking />} />
            <Route path="/s/:slug/*" element={<PublicBooking />} />
            <Route path="/lich-hen-cua-toi" element={<MyBooking />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard/*"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
