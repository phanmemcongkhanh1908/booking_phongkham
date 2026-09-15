import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  CalendarPlus, 
  User, 
  Phone, 
  Clock, 
  Calendar as CalendarIcon, 
  Stethoscope, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  ExternalLink,
  ShieldAlert,
  Loader2,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../../services/api';

interface CreateAppointmentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string; // YYYY-MM-DD
  initialTime?: string; // HH:mm
}

export default function CreateAppointmentModal({
  onClose,
  onSuccess,
  initialDate,
  initialTime,
}: CreateAppointmentModalProps) {
  // Form fields
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(initialTime || '09:00');
  const [status, setStatus] = useState<'CONFIRMED' | 'REQUESTED'>('CONFIRMED');
  const [notes, setNotes] = useState('');
  const [forceOverride, setForceOverride] = useState(false);

  // Metadata
  const [services, setServices] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [existingPatients, setExistingPatients] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Patient search dropdown
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setLoadingMeta(true);
        const [servicesRes, providersRes, patientsRes] = await Promise.allSettled([
          api.get('/admin/services'),
          api.get('/admin/providers'),
          api.get('/patients')
        ]);

        if (!isMounted) return;

        // Services
        if (servicesRes.status === 'fulfilled' && servicesRes.value.data.success) {
          const sList = servicesRes.value.data.data || [];
          setServices(sList);
          if (sList.length > 0 && !selectedServiceId) {
            setSelectedServiceId(sList[0].id);
          }
        } else {
          // Fallback to public
          const pubS = await api.get('/public/services').catch(() => ({ data: { data: [] } }));
          if (isMounted && pubS.data.data) {
            setServices(pubS.data.data);
            if (pubS.data.data.length > 0) setSelectedServiceId(pubS.data.data[0].id);
          }
        }

        // Providers
        if (providersRes.status === 'fulfilled' && providersRes.value.data.success) {
          const pList = providersRes.value.data.data || [];
          setProviders(pList);
          const defaultPrv = pList.find((p: any) => p.isDefault) || pList[0];
          if (defaultPrv && !selectedProviderId) {
            setSelectedProviderId(defaultPrv.id);
          }
        }

        // Patients
        if (patientsRes.status === 'fulfilled' && patientsRes.value.data.success) {
          setExistingPatients(patientsRes.value.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load appointment form metadata', err);
      } finally {
        if (isMounted) setLoadingMeta(false);
      }
    };

    loadMetadata();
    return () => { isMounted = false; };
  }, []);

  // Filtered patients for autocomplete
  const filteredPatients = useMemo(() => {
    const q = phone.trim() || patientName.trim();
    if (!q || q.length < 2) return [];
    const cleanQ = q.toLowerCase();
    const cleanDigits = q.replace(/\D/g, '');

    return existingPatients.filter(p => {
      const matchName = p.fullName && p.fullName.toLowerCase().includes(cleanQ);
      const matchPhone = cleanDigits.length >= 3 && p.phone && p.phone.includes(cleanDigits);
      return matchName || matchPhone;
    }).slice(0, 5);
  }, [existingPatients, phone, patientName]);

  const selectExistingPatient = (p: any) => {
    setPatientName(p.fullName || '');
    setPhone(p.phone || '');
    setSelectedPatientId(p.id);
    setShowPatientSuggestions(false);
  };

  // Selected Service details
  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  // Calculate estimated end time
  const calculatedEndTime = useMemo(() => {
    try {
      if (!date || !time) return '';
      const [hours, minutes] = time.split(':').map(Number);
      const startDate = new Date(date);
      startDate.setHours(hours, minutes, 0, 0);
      const duration = selectedService?.durationMins || 30;
      const endDate = addMinutes(startDate, duration);
      return format(endDate, 'HH:mm');
    } catch {
      return '';
    }
  }, [date, time, selectedService]);

  // Quick preset time slots
  const quickTimePresets = [
    '08:30', '09:00', '09:30', '10:00', '10:30', 
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  const handleSubmit = async (e?: React.FormEvent, force: boolean = forceOverride) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validate
    if (!patientName.trim()) {
      setErrorMessage('Vui lòng nhập họ tên khách hàng');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage('Số điện thoại không hợp lệ (tối thiểu 9-10 chữ số)');
      return;
    }
    if (!selectedServiceId) {
      setErrorMessage('Vui lòng chọn dịch vụ nha khoa');
      return;
    }
    if (!date || !time) {
      setErrorMessage('Vui lòng chọn ngày và giờ hẹn');
      return;
    }

    try {
      setSubmitting(true);
      const [hours, minutes] = time.split(':').map(Number);
      const startAtDate = new Date(date);
      startAtDate.setHours(hours, minutes, 0, 0);

      const duration = selectedService?.durationMins || 30;
      const endAtDate = addMinutes(startAtDate, duration);

      const payload = {
        patientName: patientName.trim(),
        phone: cleanPhone,
        patientId: selectedPatientId || undefined,
        serviceId: selectedServiceId,
        providerId: selectedProviderId || undefined,
        startAt: startAtDate.toISOString(),
        endAt: endAtDate.toISOString(),
        notes: notes.trim(),
        status: status,
        force: force
      };

      const res = await api.post('/appointments/quick', payload);

      if (res.data.success) {
        toast.success(`Đã tạo lịch hẹn thành công cho ${patientName.trim()}!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra khi tạo lịch hẹn';
      setErrorMessage(msg);
      // If it's a conflict error, suggest force override
      if (msg.includes('đụng lịch') || msg.includes('xung đột')) {
        setForceOverride(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={() => setShowPatientSuggestions(false)}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-800">Thêm lịch hẹn mới</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Tiếp nhận tại quầy
                </span>
              </div>
              <p className="text-xs text-slate-500">Lên lịch hẹn khám nhanh cho bệnh nhân gọi điện hoặc đến trực tiếp</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e)} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Không thể tạo lịch hẹn:</span>
                <span>{errorMessage}</span>
                {errorMessage.includes('đụng lịch') && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleSubmit(undefined, true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Xác nhận đè lịch (Ưu tiên tiếp nhận)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Thông tin bệnh nhân */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                Thông tin bệnh nhân
              </label>
              {selectedPatientId ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <UserCheck className="w-3 h-3" /> Đã khớp hồ sơ cũ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Tự động tạo hồ sơ mới nếu chưa có
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              {/* Họ tên */}
              <div className="relative">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Họ và tên *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn An"
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value);
                      setSelectedPatientId(null);
                      setShowPatientSuggestions(true);
                    }}
                    onFocus={() => setShowPatientSuggestions(true)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Số điện thoại */}
              <div className="relative">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Số điện thoại *</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="VD: 0912345678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setSelectedPatientId(null);
                      setShowPatientSuggestions(true);
                    }}
                    onFocus={() => setShowPatientSuggestions(true)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Autocomplete Patient Suggestions Dropdown */}
              {showPatientSuggestions && filteredPatients.length > 0 && (
                <div 
                  className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-30 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Gợi ý bệnh nhân trong hệ thống:
                  </div>
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectExistingPatient(p)}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-teal-50 flex items-center justify-between text-xs transition-colors group cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-slate-800 group-hover:text-teal-900 block">{p.fullName}</span>
                        <span className="text-slate-500 text-[11px]">{p.phone}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                        Chọn bệnh nhân này
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Dịch vụ & Bác sĩ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dịch vụ */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                Dịch vụ khám / điều trị *
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMins || 30}p - {Number(s.price || 0).toLocaleString('vi-VN')}đ)
                  </option>
                ))}
              </select>
            </div>

            {/* Bác sĩ */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                Bác sĩ phụ trách
              </label>
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
              >
                <option value="">Tự động chỉ định bác sĩ khả dụng</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.specialty ? `(${p.specialty})` : ''} {p.isDefault ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Ngày & Giờ khám */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
                Thời gian hẹn khám
              </label>
              {calculatedEndTime && (
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                  Dự kiến: {time} - {calculatedEndTime} ({selectedService?.durationMins || 30} phút)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Ngày hẹn *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Giờ hẹn (Bắt đầu) *</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Time Presets */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Khung giờ gợi ý nhanh:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickTimePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTime(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      time === preset
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Trạng thái & Ghi chú */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                Trạng thái lịch
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
              >
                <option value="CONFIRMED">Xác nhận ngay (CONFIRMED)</option>
                <option value="REQUESTED">Chờ tiếp nhận (REQUESTED)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {status === 'CONFIRMED' ? 'Lịch được chốt ngay, gửi thông báo cho khách' : 'Lịch ở trạng thái chờ duyệt tiếp nhận'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Ghi chú điều trị / Yêu cầu của khách
              </label>
              <input
                type="text"
                placeholder="VD: Bệnh nhân đau răng hàm dưới, cần kiểm tra gấp..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          {/* Conflict override checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="forceOverride"
              checked={forceOverride}
              onChange={(e) => setForceOverride(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
            <label htmlFor="forceOverride" className="text-xs text-slate-600 cursor-pointer select-none">
              Cho phép xếp lịch trùng giờ nếu phòng khám quá tải hoặc ca khám khẩn cấp
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href="/book"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1 font-medium order-2 sm:order-1"
          >
            <span>Mở trang đặt lịch trực tuyến của bệnh nhân (/book)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting || loadingMeta}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tạo lịch...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lưu lịch hẹn</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
