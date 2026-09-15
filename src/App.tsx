import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import NotificationManager from './components/NotificationManager';

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
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
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
            <Route path="/" element={<Navigate to="/book" replace />} />
            <Route path="/book/*" element={<PublicBooking />} />
            <Route path="/booking/:slug/*" element={<PublicBooking />} />
            <Route path="/b/:slug/*" element={<PublicBooking />} />
            <Route path="/s/:slug/*" element={<PublicBooking />} />
            <Route path="/lich-hen-cua-toi" element={<MyBooking />} />
            <Route path="/admin/login" element={<Login />} />

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
