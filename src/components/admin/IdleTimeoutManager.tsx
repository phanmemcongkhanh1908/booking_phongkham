import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { ShieldAlert, AlertTriangle, LogOut } from 'lucide-react';
import api from '../../services/api';

export default function IdleTimeoutManager() {
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60); // 60 seconds warning
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch timeout settings
  useEffect(() => {
    api.get('/admin/settings').then(res => {
      if (res.data?.success && res.data.data?.idleTimeoutMinutes) {
        setIdleTimeoutMinutes(Number(res.data.data.idleTimeoutMinutes));
      }
    }).catch(console.error);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/admin/login');
  }, [logout, navigate]);

  const lastActivityRef = useRef<number>(0);

  const resetTimer = useCallback(() => {
    if (showWarning) return; // Don't reset if warning is already showing (user must click)
    
    const now = Date.now();
    if (now - lastActivityRef.current < 1000) return; // Throttle to 1 second
    lastActivityRef.current = now;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setShowWarning(prev => prev === false ? prev : false);
    setCountdown(prev => prev === 60 ? prev : 60);

    if (idleTimeoutMinutes && idleTimeoutMinutes > 0) {
      // Set idle timer
      idleTimerRef.current = setTimeout(() => {
        setShowWarning(true);
      }, idleTimeoutMinutes * 60 * 1000);
    }
  }, [idleTimeoutMinutes, showWarning]);

  // Handle countdown when warning shows
  useEffect(() => {
    if (showWarning) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showWarning, handleLogout]);

  // Setup event listeners
  useEffect(() => {
    if (!idleTimeoutMinutes) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handleActivity));
    resetTimer(); // Start initial timer

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [idleTimeoutMinutes, resetTimer]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="p-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-amber-50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Cảnh báo không hoạt động</h2>
          <p className="text-sm text-slate-600 mb-6">
            Hệ thống phát hiện bạn không có thao tác nào trong một khoảng thời gian dài. Vì lý do bảo mật, phiên đăng nhập sẽ tự động kết thúc sau:
          </p>
          <div className="text-5xl font-black text-amber-500 mb-6 font-mono bg-amber-50 px-6 py-3 rounded-xl border border-amber-100">
            {countdown}s
          </div>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Đăng xuất
            </button>
            <button
              onClick={() => {
                setShowWarning(prev => prev === false ? prev : false);
                resetTimer();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Tiếp tục sử dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
