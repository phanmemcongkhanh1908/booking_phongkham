import React from 'react';
import { useBookingStore } from '../../store/booking';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import ServiceSelection from './components/ServiceSelection';
import DateTimeSelection from './components/DateTimeSelection';
import PatientForm from './components/PatientForm';
import SuccessView from './components/SuccessView';

export default function Booking() {
  const step = useBookingStore((state) => state.step);

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-8 relative">
      <div className="mx-auto max-w-2xl pb-16">
        {step < 4 && (
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-text-main">Dental Smart Booking</h1>
            <p className="mt-2 text-text-muted">Đặt lịch khám nhanh chóng chỉ trong vài bước</p>
            
            {/* Step Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {[1, 2, 3].map((i) => (
                <React.Fragment key={i}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${step >= i ? 'bg-primary text-white' : 'bg-slate-200 text-text-muted'}`}>
                    {i}
                  </div>
                  {i < 3 && <div className={`h-1 w-12 rounded transition-colors ${step > i ? 'bg-primary' : 'bg-slate-200'}`} />}
                </React.Fragment>
              ))}
            </div>
          </header>
        )}

        <div className="mt-8">
          {step === 1 && <ServiceSelection />}
          {step === 2 && <DateTimeSelection />}
          {step === 3 && <PatientForm />}
          {step === 4 && <SuccessView />}
        </div>
      </div>

      {/* Floating Admin Button */}
      <div className="fixed bottom-6 right-6 z-50 animate-bounce">
        <Link 
          to="/admin/login" 
          className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <ShieldAlert className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
