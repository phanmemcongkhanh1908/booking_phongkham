import React, { useState, useEffect } from 'react';
import { 
  BellRing, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Eye, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  X, 
  Timer,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useBroadcastStore, BroadcastAppointment } from '../store/broadcastStore';
import api from '../services/api';

export default function BroadcastAlertBar() {
  const { 
    enabled, 
    pendingList, 
    isPlaying, 
    currentPlayingTitle,
    reminderIntervalSeconds,
    acknowledgeAppointment, 
    confirmAppointmentQuick, 
    snoozeAppointment, 
    dismissAppointment,
    testBroadcast
  } = useBroadcastStore();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update timer every second for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter unconfirmed and active items
  const activeItems = pendingList.filter(
    (item) => !item.isConfirmed && item.status !== 'CONFIRMED' && item.status !== 'CANCELLED'
  );

  if (activeItems.length === 0 && !isPlaying) {
    return null;
  }

  const handleQuickConfirm = async (id: string) => {
    setConfirmingId(id);
    try {
      await confirmAppointmentQuick(id, api);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div id="broadcast-alert-container" className="fixed bottom-5 right-5 z-50 max-w-lg w-[calc(100vw-2.5rem)] sm:w-[480px] flex flex-col gap-3 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Live Speaking Indicator Pill */}
      {isPlaying && (
        <div className="bg-indigo-900/95 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md border border-indigo-500/30 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center w-6 h-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <Volume2 className="w-4 h-4 text-indigo-300 relative z-10" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-indigo-200 mr-2">Đang phát thanh:</span>
              <span className="text-white font-medium truncate">{currentPlayingTitle || "Thông báo lịch hẹn..."}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-3 bg-indigo-400 rounded-full animate-pulse"></span>
            <span className="w-1.5 h-4.5 bg-emerald-400 rounded-full animate-pulse delay-75"></span>
            <span className="w-1.5 h-3 bg-indigo-400 rounded-full animate-pulse delay-150"></span>
          </div>
        </div>
      )}

      {/* List of Pending Appointments Needing Manager Attention */}
      {activeItems.map((item) => {
        const isSnoozed = item.snoozeUntil && now < item.snoozeUntil;
        const remainingSnoozeSec = isSnoozed ? Math.max(0, Math.ceil((item.snoozeUntil! - now) / 1000)) : 0;
        
        // Calculate seconds until next reminder
        const elapsedSinceLastAnnounce = Math.floor((now - item.lastAnnouncedAt) / 1000);
        const secUntilNextReminder = Math.max(0, reminderIntervalSeconds - elapsedSinceLastAnnounce);

        return (
          <div 
            key={item.id}
            id={`broadcast-item-${item.id}`}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-amber-400/80 ring-4 ring-amber-400/10 flex flex-col gap-3.5 transition-all hover:shadow-amber-500/20"
          >
            {/* Header Badge & Countdown */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                  {item.reminderCount > 0 ? `Đã nhắc nhở ${item.reminderCount} lần` : 'Lịch hẹn mới chưa chốt'}
                </span>
              </div>

              {/* Countdown / Status Tag */}
              <div className="text-xs text-slate-500 flex items-center gap-1 font-mono bg-slate-100 px-2 py-1 rounded-lg">
                {isSnoozed ? (
                  <>
                    <Timer className="w-3 h-3 text-indigo-500" />
                    <span>Tạm hoãn: {Math.floor(remainingSnoozeSec / 60)}m{remainingSnoozeSec % 60}s</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Nhắc lại sau: {secUntilNextReminder}s</span>
                  </>
                )}
              </div>
            </div>

            {/* Patient & Service Details */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{item.patientName}</span>
                  {item.patientPhone && (
                    <a 
                      href={`tel:${item.patientPhone}`}
                      className="text-xs font-normal text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                      title="Gọi điện cho khách hàng"
                    >
                      <Phone className="w-3 h-3" />
                      {item.patientPhone}
                    </a>
                  )}
                </h4>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded">
                  {item.serviceName}
                </span>
                {item.providerName && (
                  <span className="text-slate-500">
                    BS: <strong className="text-slate-700">{item.providerName}</strong>
                  </span>
                )}
                <span className="text-slate-500">
                  Giờ hẹn: <strong className="text-emerald-700">{formatTime(item.startAt)}</strong>
                </span>
              </div>
            </div>

            {/* Actions: Chốt lịch ngay, Xem chi tiết, Tạm hoãn */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              {/* Primary Action: Chốt lịch ngay */}
              <button
                id={`btn-confirm-${item.id}`}
                onClick={() => handleQuickConfirm(item.id)}
                disabled={confirmingId === item.id}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{confirmingId === item.id ? 'Đang chốt...' : 'Chốt lịch ngay'}</span>
              </button>

              {/* Secondary Action: Tạm hoãn 2 phút */}
              <button
                id={`btn-snooze-${item.id}`}
                onClick={() => snoozeAppointment(item.id, 2)}
                className="bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Tạm dừng nhắc nhở trong 2 phút"
              >
                <Timer className="w-3.5 h-3.5 text-slate-500" />
                <span>Hoãn 2p</span>
              </button>

              {/* Dismiss / Acknowledge */}
              <button
                id={`btn-dismiss-${item.id}`}
                onClick={() => acknowledgeAppointment(item.id)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Đã xem (Dừng nhắc nhở)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return `${time} (${date})`;
  } catch {
    return isoString;
  }
}
