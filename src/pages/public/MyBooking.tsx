import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Calendar as CalendarIcon, Clock, Stethoscope, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { APPOINTMENT_STATUSES } from '../../constants/appointmentStatus';

interface AppointmentData {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  serviceName: string;
  providerName: string | null;
  patientName: string;
}

export default function MyBooking() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      const myAppts = JSON.parse(localStorage.getItem('myAppointments') || '[]');
      if (myAppts.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          myAppts.map(async (id: string) => {
            try {
              const res = await api.get(`/public/appointments/${id}`);
              if (res.data.success) {
                return res.data.data;
              }
            } catch (err) {
              console.error(err);
            }
            return null;
          })
        );
        setAppointments(results.filter(Boolean));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          <Link to="/book/dich-vu" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors text-text-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-main">
            Lịch hẹn của tôi
          </h1>
        </header>

        {loading ? (
          <div className="text-center py-12 text-text-muted">Đang tải...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-card border border-border-subtle">
            <p className="text-text-muted mb-4">Bạn chưa có lịch hẹn nào hoặc bạn dùng trình duyệt khác.</p>
            <Link to="/book/dich-vu" className="text-primary font-medium hover:underline">
              Đặt lịch mới ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map(apt => {
              const statusConfig = APPOINTMENT_STATUSES[apt.status as keyof typeof APPOINTMENT_STATUSES] || APPOINTMENT_STATUSES.PENDING;
              const StatusIcon = statusConfig.icon;
              return (
                <Card key={apt.id} className="border border-border-subtle shadow-soft bg-surface">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4 border-b border-border-subtle pb-4">
                      <div>
                        <h3 className="font-bold text-text-main">{apt.serviceName}</h3>
                        <p className="text-sm text-text-muted mt-1 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5" />
                          {apt.providerName || 'Bác sĩ chuyên khoa'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-text-muted block mb-1">Ngày hẹn</span>
                        <div className="font-medium text-text-main flex items-center gap-1.5">
                          <CalendarIcon className="w-4 h-4 text-primary" />
                          {format(new Date(apt.startAt), 'dd/MM/yyyy')}
                        </div>
                      </div>
                      <div>
                        <span className="text-text-muted block mb-1">Giờ hẹn</span>
                        <div className="font-medium text-text-main flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" />
                          {format(new Date(apt.startAt), 'HH:mm')} - {format(new Date(apt.endAt), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
