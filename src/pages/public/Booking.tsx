
import React, { useEffect } from 'react';
import { useBookingStore } from '../../store/booking';
import { Link, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Check } from 'lucide-react';
import ServiceSelection from './components/ServiceSelection';
import DateTimeSelection from './components/DateTimeSelection';
import PatientForm from './components/PatientForm';
import SuccessView from './components/SuccessView';

export default function Booking() {
  const store = useBookingStore();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = [
    { id: 1, title: 'Dịch vụ', path: 'dich-vu' },
    { id: 2, title: 'Thời gian', path: 'chon-gio' },
    { id: 3, title: 'Thông tin', path: 'thong-tin' },
    { id: 4, title: 'Hoàn tất', path: 'hoan-tat' }
  ];

  const currentPath = location.pathname.split('/').pop() || '';
  const currentStepObj = steps.find(s => s.path === currentPath);
  const step = currentStepObj ? currentStepObj.id : 1;

  
  const serviceId = useBookingStore(s => s.serviceId);
  const selectedDate = useBookingStore(s => s.selectedDate);

  useEffect(() => {
    if (currentPath === 'book' || currentPath === '') {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 2 && !serviceId) {
      navigate('/book/dich-vu', { replace: true });
    } else if (step >= 3 && !selectedDate) {
      navigate('/book/chon-gio', { replace: true });
    }
  }, [currentPath, step, serviceId, selectedDate, navigate]);


  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-8 relative selection:bg-primary/20">
      <div className="mx-auto max-w-2xl pb-20">
        {step < 4 && (
          <header className="mb-10 mt-4 md:mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-text-main">
              Dental Smart <span className="text-primary">Booking</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-text-muted">
              Đặt lịch khám nhanh chóng, tiện lợi chỉ trong vài bước
            </p>
            
            <div className="mt-10 mx-auto max-w-md px-4">
              <div className="relative flex items-center justify-between">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border-subtle rounded-full" />
                
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((step - 1) / (steps.length - 2)) * 100}%` }}
                />
                {steps.slice(0, 3).map((s) => {
                  const isActive = step === s.id;
                  const isCompleted = step > s.id;
                  return (
                    <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                      <div 
                        className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 shadow-sm ${
                          isActive 
                            ? 'bg-primary text-on-primary ring-4 ring-primary/20 scale-110' 
                            : isCompleted
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface text-text-muted border border-border-subtle'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : s.id}
                      </div>
                      <span className={`text-xs md:text-sm font-medium absolute -bottom-6 w-max text-center transition-colors ${
                        isActive ? 'text-primary' : isCompleted ? 'text-text-main' : 'text-text-muted'
                      }`}>
                        {s.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </header>
        )}
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both">
          <Routes>
            <Route path="dich-vu" element={<ServiceSelection />} />
            <Route path="chon-gio" element={<DateTimeSelection />} />
            <Route path="thong-tin" element={<PatientForm />} />
            <Route path="hoan-tat" element={<SuccessView />} />
            <Route path="*" element={<Navigate to="dich-vu" replace />} />
          </Routes>
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <Link 
          to="/admin/login" 
          className="group flex items-center justify-center h-12 w-12 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all duration-300 ring-4 ring-slate-900/10"
          title="Khu vực Quản trị"
        >
          <ShieldAlert className="h-5 w-5 group-hover:text-warning transition-colors" />
        </Link>
      </div>
    </div>
  );
}
