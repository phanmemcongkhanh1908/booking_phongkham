import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { X, CalendarPlus, User, Clock, CheckCircle, XCircle, Stethoscope, FileText, DollarSign, Send, Trash2, Edit3, PhoneCall } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import api from '../../services/api';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = {
  'vi': vi,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function CalendarView({ appointments, handleUpdateStatus, refreshAppointments }: { appointments: any[], handleUpdateStatus: (id: string, status: string) => void, refreshAppointments?: () => void }) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showNextAptForm, setShowNextAptForm] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [nextService, setNextService] = useState('');
  
  // Trạng thái cho Calendar view và date
  const [view, setView] = useState<any>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  
  // Trạng thái cho popup chọn thời gian
  const [slotMenu, setSlotMenu] = useState<{ start: Date, end: Date } | null>(null);
  
  // Quick Booking State
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [quickBookPatient, setQuickBookPatient] = useState('');
  const [quickBookPhone, setQuickBookPhone] = useState('');
  const [quickBookService, setQuickBookService] = useState('');
  const [quickBookLoading, setQuickBookLoading] = useState(false);

  const handleSelectSlot = (slotInfo: { start: Date, end: Date }) => {
    setSlotMenu({ start: slotInfo.start, end: slotInfo.end });
  };

  const handleQuickBook = async () => {
    if (!slotMenu) return;
    if (!quickBookPatient || !quickBookPhone || !quickBookService) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }
    
    try {
      setQuickBookLoading(true);
      // Tạo lịch hẹn trực tiếp (bypass bước tạo session của khách hàng)
      // Tạo bệnh nhân ẩn hoặc tạo mới trước rồi lấy ID
      // Giả định backend có hỗ trợ tạo lịch kèm số đt để tự lookup/tạo patient
      const payload = {
        patientName: quickBookPatient,
        phone: quickBookPhone,
        serviceId: quickBookService,
        startAt: slotMenu.start.toISOString(),
        endAt: slotMenu.end.toISOString(),
      };
      const res = await api.post('/appointments', payload);
      if (res.data.success) {
        toast.success('Đã đặt lịch hẹn mới!');
        setShowQuickBook(false);
        setSlotMenu(null);
        setQuickBookPatient('');
        setQuickBookPhone('');
        if (refreshAppointments) refreshAppointments();
      }
    } catch (error) {
      toast.error('Lỗi khi thêm lịch hẹn');
    } finally {
      setQuickBookLoading(false);
    }
  };

  useEffect(() => {
    // Tải danh mục dịch vụ để admin chọn khi đặt lịch tiếp theo
    api.get('/public/services').then(res => {
      setServices(res.data.data || []);
      if (res.data.data && res.data.data.length > 0) {
        setNextService(res.data.data[0].id);
      }
    });
  }, []);

  const events = useMemo(() => {
    return appointments.map(apt => ({
      id: apt.id,
      title: `${apt.patientName} - ${apt.serviceName}`,
      start: new Date(apt.startAt),
      end: new Date(apt.endAt),
      resource: apt,
    }));
  }, [appointments]);



  const handleDeleteApt = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa lịch hẹn này?")) {
      try {
        await api.delete(`/appointments/${id}`);
        toast.success("Đã xóa lịch hẹn");
        setSelectedEvent(null);
        if (refreshAppointments) refreshAppointments();
      } catch (err: any) {
        console.error("Delete error:", err);
        const errorMsg = err.response?.data?.error?.message || err.message;
        toast.error(`Lỗi khi xóa lịch hẹn: ${errorMsg}`);
      }
    }
  };

  const handleRemind = async (id: string) => {

    try {
      const loadingToast = toast.loading("Đang gửi tin nhắn...");
      const res = await api.post(`/appointments/${id}/remind`);
      toast.dismiss(loadingToast);
      toast.success(res.data.message || "Đã gửi thông báo nhắc lịch");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.response?.data?.error?.message || "Không thể gửi tin nhắn nhắc lịch");
    }
  };

  const eventPropGetter = (event: any) => {

    let backgroundColor = 'var(--status-available-bg)';
    let borderColor = 'var(--status-available)';
    switch (event.resource.status) {
      case 'REQUESTED':
      case 'PENDING': backgroundColor = 'var(--status-pending-bg)'; borderColor = 'var(--status-pending)'; break;
      case 'CONFIRMED': backgroundColor = 'var(--status-confirmed-bg)'; borderColor = 'var(--status-confirmed)'; break;
      case 'CHECKED_IN': backgroundColor = 'var(--status-checked-in-bg)'; borderColor = 'var(--status-checked-in)'; break;
      case 'IN_SERVICE': backgroundColor = 'var(--status-in-service-bg)'; borderColor = 'var(--status-in-service)'; break;
      case 'COMPLETED': backgroundColor = 'var(--status-completed-bg)'; borderColor = 'var(--status-completed)'; break;
      case 'CANCEL_PATIENT':
      case 'CANCEL_CLINIC':
      case 'CANCELLED':
      case 'NO_SHOW': backgroundColor = 'var(--status-no-show-bg)'; borderColor = 'var(--status-no-show)'; break;
      case 'WAITLIST': backgroundColor = 'var(--status-waitlist-bg)'; borderColor = 'var(--status-waitlist)'; break;
      case 'BLOCKED': backgroundColor = 'var(--status-blocked-bg)'; borderColor = 'var(--status-blocked)'; break;
    }
    return { 
      style: { 
        backgroundColor, 
        borderColor,
        borderWidth: '1px',
        borderLeftWidth: '4px',
        color: 'var(--text-main)',
        fontWeight: 500,
        fontSize: '0.8rem',
        borderRadius: 'var(--radius-card)'
      } 
    };
  };

  const handleBookNext = async () => {
    if (!nextDate || !nextTime || !nextService) {
      toast.error("Vui lòng nhập đủ ngày giờ và dịch vụ");
      return;
    }
    const startAt = new Date(`${nextDate}T${nextTime}:00`);
    const endAt = new Date(startAt.getTime() + 30 * 60000); // Tạm tính 30p, nên lấy từ dịch vụ
    
    try {
      await api.post('/appointments/next', {
        patientId: selectedEvent.resource.patientId,
        providerId: selectedEvent.resource.providerId,
        serviceId: nextService,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        notes: "Lịch hẹn tái khám"
      });
      toast.success("Đặt lịch tái khám thành công!");
      setShowNextAptForm(false);
      setSelectedEvent(null);
      if (refreshAppointments) refreshAppointments();
    } catch(err) {
      toast.error("Có lỗi xảy ra khi đặt lịch");
    }
  };

  const onEventDrop = async ({ event, start, end }: any) => {
    try {
      await api.patch(`/appointments/${event.id}/time`, {
        startAt: start.toISOString(),
        endAt: end.toISOString()
      });
      toast.success("Cập nhật thời gian thành công!");
      if (refreshAppointments) refreshAppointments();
    } catch (err) {
      toast.error("Không thể cập nhật thời gian");
    }
  };

  return (
    <div className="h-[700px] bg-surface p-2 sm:p-4 rounded-card shadow-soft border border-border-subtle relative calendar-wrapper flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-text-main hidden sm:block">Lịch trình nha khoa</h2>
      </div>
      <style>{`
        .calendar-wrapper .rbc-header { padding: 12px 0; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 0.8rem; border-bottom: 2px solid #e2e8f0; }
        .calendar-wrapper .rbc-today { background-color: #f8fafc; }
        .calendar-wrapper .rbc-event { padding: 4px 6px; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
        .calendar-wrapper .rbc-time-view { border: none; border-top: 1px solid #e2e8f0; }
        .calendar-wrapper .rbc-time-header { border-bottom: 1px solid #e2e8f0; }
        .calendar-wrapper .rbc-addons-dnd .rbc-addons-dnd-resizable { z-index: 10; }
        .calendar-wrapper .rbc-toolbar { flex-wrap: wrap; gap: 10px; margin-bottom: 15px; }
      `}</style>
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[768px] h-full">
          <DnDCalendar
            localizer={localizer}
            events={events}
            style={{ height: '100%' }}
            eventPropGetter={eventPropGetter}
            onSelectEvent={(e) => setSelectedEvent(e)}
            onEventDrop={onEventDrop}
            selectable={true}
            onSelectSlot={handleSelectSlot}
            resizable={false}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            culture="vi"
            messages={{
              today: 'Hôm nay',
              previous: 'Trước',
              next: 'Tiếp',
              month: 'Tháng',
              week: 'Tuần',
              day: 'Ngày',
              agenda: 'Danh sách',
              date: 'Ngày',
              time: 'Thời gian',
              event: 'Lịch hẹn',
              noEventsInRange: 'Không có lịch hẹn nào trong thời gian này.',
            }}
          />
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-card shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-bg-base">
              <h3 className="font-semibold text-text-main flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-primary" />
                Chi tiết lịch hẹn
              </h3>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleDeleteApt(selectedEvent.id)} 
                  className="p-1.5 text-status-cancelled hover:bg-status-cancelled-bg rounded-md transition-colors"
                  title="Xóa lịch hẹn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => {setSelectedEvent(null); setShowNextAptForm(false);}} className="text-text-muted/60 hover:text-text-muted p-1.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-mint text-primary flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <h4 className="font-medium text-text-main flex items-center gap-2">
                    {selectedEvent.resource.patientName}
                    <a href={`tel:${selectedEvent.resource.patientPhone}`} className="p-1.5 bg-mint text-primary rounded-full hover:bg-mint" title="Gọi cho bệnh nhân">
                      <PhoneCall className="w-4 h-4" />
                    </a>
                  </h4>
                  <p className="text-sm text-text-muted">{selectedEvent.resource.patientPhone}</p>
                </div>

              </div>

              {/* Mini EMR */}
              <div className="bg-bg-base rounded-lg p-3 space-y-2 border border-border-subtle">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted flex items-center gap-1"><FileText className="w-4 h-4" /> Bệnh án</span>
                  <span className="font-medium text-text-main">{selectedEvent.resource.allergies || 'Không có dị ứng'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted flex items-center gap-1"><CheckCircle className="w-4 h-4" /> X-Quang gần nhất</span>
                  <span className="font-medium text-text-main">{selectedEvent.resource.lastXRayDate ? format(new Date(selectedEvent.resource.lastXRayDate), 'dd/MM/yyyy') : 'Chưa chụp'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted flex items-center gap-1"><DollarSign className="w-4 h-4" /> Công nợ</span>
                  <span className={`font-medium ${(Number(selectedEvent.resource?.debt) || 0) > 0 ? 'text-status-cancelled' : 'text-green-600'}`}>
                    {(Number(selectedEvent.resource?.debt) || 0) > 0 ? `${(Number(selectedEvent.resource?.debt) || 0).toLocaleString('vi-VN')} đ` : 'Hoàn tất'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Dịch vụ</p>
                  <p className="text-sm font-medium text-text-main">{selectedEvent.resource.serviceName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Thời gian</p>
                  <p className="text-sm font-medium text-text-main flex items-center gap-1">
                    <Clock className="w-4 h-4 text-text-muted/60" />
                    {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}
                  </p>
                </div>
              </div>

              {!showNextAptForm ? (
                <div className="pt-4 flex gap-2">
                  <Button 
                    className="flex-1 bg-surface text-primary border border-primary hover:bg-mint"
                    onClick={() => handleRemind(selectedEvent.id)}
                  >
                    <Send className="w-4 h-4 mr-1" /> Nhắc hẹn (Bot)
                  </Button>
                  <Button 
                    className="flex-1 bg-surface text-primary border border-primary hover:bg-mint"
                    onClick={() => setShowNextAptForm(true)}
                  >
                    Tái khám
                  </Button>

                  {selectedEvent.resource.status === 'REQUESTED' && (
                    <Button 
                      className="flex-1 bg-status-completed opacity-90 hover:opacity-100 text-white"
                      onClick={() => { handleUpdateStatus(selectedEvent.id, 'CONFIRMED'); setSelectedEvent(null); }}
                    >
                      Xác nhận hẹn
                    </Button>
                  )}
                </div>
              ) : (
                <div className="pt-4 border-t border-border-subtle space-y-4">
                  <h4 className="text-sm font-medium text-text-main">Lên lịch hẹn tiếp theo</h4>
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">Dịch vụ</label>
                    <select 
                      className="w-full text-sm border-border-subtle rounded-md shadow-soft focus:border-primary focus:ring-primary"
                      value={nextService}
                      onChange={e => setNextService(e.target.value)}
                    >
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">Ngày</label>
                      <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">Giờ</label>
                      <Input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowNextAptForm(false)}>Hủy</Button>
                    <Button className="flex-1" onClick={handleBookNext}>Lưu lịch hẹn</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Menu thao tác khi click vào một khung giờ */}
      {slotMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-card w-full max-w-sm p-6 shadow-xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-text-main mb-2">
              {showQuickBook ? 'Thêm lịch hẹn' : 'Thao tác'}
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Thời gian: {format(slotMenu.start, 'HH:mm dd/MM/yyyy')} 
            </p>
            
            {showQuickBook ? (
              <div className="flex flex-col gap-3">
                <Input placeholder="Tên khách hàng" value={quickBookPatient} onChange={e => setQuickBookPatient(e.target.value)} />
                <Input placeholder="Số điện thoại" value={quickBookPhone} onChange={e => setQuickBookPhone(e.target.value)} />
                <select 
                  className="w-full text-sm border-border-subtle rounded-md shadow-soft focus:border-primary focus:ring-primary"
                  value={quickBookService}
                  onChange={e => setQuickBookService(e.target.value)}
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowQuickBook(false)}>Quay lại</Button>
                  <Button className="flex-1" onClick={handleQuickBook} disabled={quickBookLoading}>Xác nhận</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full inline-flex justify-center items-center gap-2"
                  onClick={() => setShowQuickBook(true)}
                >
                  <CalendarPlus className="w-4 h-4" />
                  Thêm lịch hẹn ngay
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setSlotMenu(null); setShowQuickBook(false); }}>
                  Đóng
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
