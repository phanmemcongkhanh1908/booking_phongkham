import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarClock,
  Clock,
  FileText,
  Loader2,
  Stethoscope,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  APPOINTMENT_STATUSES,
  LABEL_OVERRIDES,
  STATUS_ALIASES,
} from '../constants/appointmentStatus';

export interface BookingHistoryItem {
  id: string;
  startAt: string;
  endAt?: string | null;
  status: string;
  patientName?: string | null;
  bookedForName?: string | null;
  bookingFor?: 'self' | 'relative' | string | null;
  isProxyBooking?: boolean | null;
  serviceName?: string | null;
  providerName?: string | null;
  notes?: string | null;
}

/**
 * Removes any legacy or system-generated proxy-booking / phone-link prefixes
 * so user-facing & admin "Ghi chú" boxes only display authentic notes.
 */
export function stripSystemBookingNotes(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\[Đặt lịch hộ qua SĐT[^\]]*\]\s*/gi, '')
    .replace(/\[Đặt lịch hộ cho:[^\]]*\]\s*-?\s*/gi, '')
    .replace(/\[Đặt lịch hộ[^\]]*\]\s*-?\s*/gi, '')
    .replace(/\[Đặt cho người thân\]\s*-?\s*/gi, '')
    .replace(/\[HỆ THỐNG\]:[^\n]*\n?/gi, '')
    .replace(/^\s*[-–|]\s*/, '')
    .trim();
}

export function resolveBookingMode(item: {
  bookingFor?: string | null;
  isProxyBooking?: boolean | null;
  notes?: string | null;
}): 'self' | 'relative' {
  if (item.bookingFor === 'relative') return 'relative';
  if (item.bookingFor === 'self') return 'self';
  if (item.isProxyBooking === true) return 'relative';
  if (
    item.notes &&
    (item.notes.includes('[Đặt lịch hộ') || item.notes.includes('[Đặt cho người thân]'))
  ) {
    return 'relative';
  }
  return 'self';
}

interface CustomerBookingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  customerPhone?: string;
  appointments: BookingHistoryItem[];
  loading?: boolean;
}

export default function CustomerBookingHistoryModal({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  appointments,
  loading = false,
}: CustomerBookingHistoryModalProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'self' | 'relative'>('all');

  useEffect(() => {
    if (!isOpen) return;
    setFilterMode('all');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const normalizedItems = useMemo(() => {
    return [...(appointments || [])]
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .map((apt) => {
        const mode = resolveBookingMode(apt);
        const targetPerson =
          (apt.bookedForName || apt.patientName || customerName || 'Khách hàng').trim();
        const cleanNote = stripSystemBookingNotes(apt.notes);
        return {
          ...apt,
          resolvedMode: mode,
          targetPerson,
          cleanNote,
        };
      });
  }, [appointments, customerName]);

  const counts = useMemo(() => {
    const selfCount = normalizedItems.filter((i) => i.resolvedMode === 'self').length;
    const relativeCount = normalizedItems.filter((i) => i.resolvedMode === 'relative').length;
    return {
      all: normalizedItems.length,
      self: selfCount,
      relative: relativeCount,
    };
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'all') return normalizedItems;
    return normalizedItems.filter((i) => i.resolvedMode === filterMode);
  }, [normalizedItems, filterMode]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-booking-history-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-teal-700 shrink-0" />
              <h3
                id="customer-booking-history-title"
                className="text-base sm:text-lg font-bold text-slate-900 truncate"
              >
                Lịch sử đặt lịch khám
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              {customerName && (
                <span className="font-semibold text-slate-800">{customerName}</span>
              )}
              {customerName && customerPhone && <span aria-hidden="true">·</span>}
              {customerPhone && (
                <span className="font-mono tabular-nums text-slate-700">{customerPhone}</span>
              )}
              {(customerName || customerPhone) && <span aria-hidden="true">·</span>}
              <span className="tabular-nums">{counts.all} lượt đặt lịch</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ lịch sử"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Segmented Filter Controls */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('self')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'self'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đặt cho chính tôi ({counts.self})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('relative')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'relative'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đặt hộ người thân ({counts.relative})
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/40">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span>Đang tải lịch sử đặt lịch khám...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white rounded-xl border border-slate-200">
              <CalendarClock className="w-9 h-9 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Chưa có lịch hẹn nào trong mục này
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {filterMode === 'all'
                  ? 'Các lượt đặt lịch của khách hàng sẽ hiển thị đầy đủ tại đây.'
                  : 'Thử chuyển sang bộ lọc Tất cả để xem toàn bộ lịch sử.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const startDate = item.startAt ? new Date(item.startAt) : null;
              const hasValidDate = startDate && !isNaN(startDate.getTime());
              const mappedStatus = STATUS_ALIASES[item.status] || item.status;
              const statusConfig =
                APPOINTMENT_STATUSES[mappedStatus as keyof typeof APPOINTMENT_STATUSES] ||
                APPOINTMENT_STATUSES.PENDING;
              const statusLabel = LABEL_OVERRIDES[item.status] || statusConfig.label;
              const isRelative = item.resolvedMode === 'relative';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  {/* Top Row: Date/Time + Mode + Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span>
                        {hasValidDate
                          ? `${format(startDate, 'HH:mm')} · ${format(startDate, 'dd/MM/yyyy')}`
                          : 'Chưa rõ thời gian'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${
                          isRelative
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {isRelative ? (
                          <Users className="w-3 h-3 shrink-0" />
                        ) : (
                          <User className="w-3 h-3 shrink-0" />
                        )}
                        {isRelative ? 'Đặt hộ người thân' : 'Đặt cho chính tôi'}
                      </span>

                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{
                          backgroundColor: statusConfig.bg,
                          color: statusConfig.color,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Structured Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Đặt lịch cho ai
                      </span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {isRelative ? (
                          <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        )}
                        <span>{item.targetPerson}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Dịch vụ khám
                      </span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.serviceName || 'Khám nha khoa'}</span>
                      </span>
                      {item.providerName && (
                        <span className="text-[11px] text-slate-500 block mt-0.5 pl-5">
                          Bác sĩ: {item.providerName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Notes (only if genuine note exists) */}
                  {item.cleanNote && (
                    <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed whitespace-pre-wrap">{item.cleanNote}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
