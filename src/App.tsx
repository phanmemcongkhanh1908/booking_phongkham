import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import NotificationManager from './components/NotificationManager';

// Lazy loading pages for better performance
const PublicBooking = React.lazy(() => import('./pages/public/Booking'));
const MyBooking = React.lazy(() => import('./pages/public/MyBooking'));
const Login = React.lazy(() => import('./pages/admin/Login'));
const Dashboard = React.lazy(() => import('./pages/admin/Dashboard'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <NotificationManager />
      <React.Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/book" replace />} />
          <Route path="/book/*" element={<PublicBooking />} />
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
  );
}
