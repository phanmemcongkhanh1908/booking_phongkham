import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Phone,
  Volume2,
  VolumeX,
  X,
  Timer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  UserCheck,
  Maximize2,
} from 'lucide-react';
import { useBroadcastStore, normalizeTenantId } from '../store/broadcastStore';
import { useAuthStore } from '../store/auth';
import { TTSQueueManager } from '../services/speech/TTSQueueManager';
import { ServerSpeechEngine } from '../services/speech/ServerSpeechEngine';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function BroadcastAlertBar() {
  const user = useAuthStore((s) => s.user);
  const myTenantId = normalizeTenantId(user?.tenantId);

  const {
    pendingList,
    activePopupId,
    isPlaying,
    currentPlayingTitle,
    queueLength,
    autoplayBlocked,
    reminderIntervalSeconds,
    enabled,
    autoChime,
    openPopup,
    closePopup,
    acknowledgeAppointment,
    confirmAppointmentQuick,
    snoozeAppointment,
    dismissAppointment,
    unlockSoundAndRetry,
    stopAllPlayback,
  } = useBroadcastStore();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Strict tenant isolation even at UI rendering layer
  const activeItems = pendingList.filter(
    (item) =>
      normalizeTenantId(item.tenantId) === myTenantId &&
      !item.isConfirmed &&
      item.status !== 'CONFIRMED' &&
      item.status !== 'CANCELLED'
  );

  const activePopupItem = activePopupId
    ? activeItems.find((i) => i.id === activePopupId) || null
    : null;

  const popupIndex = activePopupItem
    ? activeItems.findIndex((i) => i.id === activePopupItem.id)
    : -1;

  if (activeItems.length === 0 && !isPlaying && !autoplayBlocked) {
    return null;
  }

  const handleQuickConfirm = async (id: string) => {
    if (id === 'demo-mobile-popup') {
      dismissAppointment(id);
      toast.success('Thao tác chốt lịch thử nghiệm thành công!');
      return;
    }
    setConfirmingId(id);
    try {
      const ok = await confirmAppointmentQuick(id, api);
      if (ok) {
        toast.success('Đã xác nhận chốt lịch hẹn!');
      } else {
        toast.error('Không thể chốt lịch lúc này, vui lòng thử lại.');
      }
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDismissPopupOrItem = (id: string) => {
    if (id === 'demo-mobile-popup') {
      dismissAppointment(id);
      return;
    }
    acknowledgeAppointment(id);
  };

  const handleReplayPopupVoice = (item: (typeof activeItems)[number]) => {
    ServerSpeechEngine.unlockAudio();
    TTSQueueManager.clearAutoplayBlocked();
    const dateLabel = formatDateLabel(item.startAt);
    const timeLabel = formatClockOnly(item.startAt);
    const doctorPart = item.providerName ? ` Bác sĩ ${item.providerName}.` : '';
    const text = `Thông báo: Khách hàng ${item.patientName}. Dịch vụ ${item.serviceName}.${doctorPart} Thời gian hẹn ${timeLabel}, ${dateLabel}.`;
    TTSQueueManager.enqueue({
      id: `replay-${item.id}-${Date.now()}`,
      title: `Đọc lại: ${item.patientName}`,
      text,
      audioUrl: item.audioUrl,
      playChime: autoChime,
      source: 'booking',
    });
  };

  // Device Screen Popup Modal (Mobile Bottom-Sheet / Desktop Centered Dialog)
  const popupModal = activePopupItem ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-booking-popup-title"
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={() => closePopup()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-teal-500/80 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90dvh] flex flex-col"
      >
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 relative">
              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-300 opacity-50" />
              <BellRing className="w-6 h-6 text-amber-200 relative z-10" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  {activePopupItem.id === 'demo-mobile-popup' ? 'Thông báo mẫu' : 'Lịch hẹn mới'}
                </span>
                {activeItems.length > 1 && (
                  <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                    {popupIndex + 1} / {activeItems.length}
                  </span>
                )}
              </div>
              <h3 id="mobile-booking-popup-title" className="text-base sm:text-lg font-extrabold leading-tight mt-1 truncate">
                {activePopupItem.patientName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => closePopup()}
            aria-label="Thu gọn popup"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Details */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Audio Playback / Unlock Banner inside Popup */}
          {(autoplayBlocked || isPlaying || enabled) && (
            <div
              className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs border ${
                autoplayBlocked
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : isPlaying
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {autoplayBlocked ? (
                  <VolumeX className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Volume2 className={`w-4 h-4 shrink-0 ${isPlaying ? 'text-indigo-600 animate-pulse' : 'text-teal-600'}`} />
                )}
                <span className="truncate font-semibold">
                  {autoplayBlocked
                    ? 'Thiết bị tạm khóa loa tự động'
                    : isPlaying
                    ? 'Đang phát nhạc hiệu & giọng đọc...'
                    : 'Phát thanh Tiếng Việt sẵn sàng'}
                </span>
              </div>

              {autoplayBlocked ? (
                <button
                  type="button"
                  onClick={unlockSoundAndRetry}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 cursor-pointer"
                >
                  Bật loa ngay
                </button>
              ) : isPlaying ? (
                <button
                  type="button"
                  onClick={stopAllPlayback}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0 cursor-pointer"
                >
                  Dừng đọc
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReplayPopupVoice(activePopupItem)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold shrink-0 cursor-pointer"
                >
                  Đọc lại
                </button>
              )}
            </div>
          )}

          {/* Customer & Booking Info */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            {activePopupItem.patientPhone && (
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                <span className="text-xs font-medium text-slate-500">Số điện thoại</span>
                <a
                  href={`tel:${activePopupItem.patientPhone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Gọi {activePopupItem.patientPhone}</span>
                </a>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium text-slate-500 shrink-0">Dịch vụ khám</span>
              <span className="text-sm font-bold text-indigo-700 text-right">{activePopupItem.serviceName}</span>
            </div>

            {activePopupItem.providerName && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Bác sĩ
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800">{activePopupItem.providerName}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Giờ hẹn khám
              </span>
              <span className="text-sm font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                {formatTime(activePopupItem.startAt)}
              </span>
            </div>
          </div>

          {/* Multi-booking Switcher */}
          {activeItems.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const prevIdx = (popupIndex - 1 + activeItems.length) % activeItems.length;
                  openPopup(activeItems[prevIdx].id);
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Lịch trước
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Còn {activeItems.length} lịch chưa chốt
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextIdx = (popupIndex + 1) % activeItems.length;
                  openPopup(activeItems[nextIdx].id);
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                Lịch tiếp <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Thumb-friendly Mobile Action Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 space-y-2.5 shrink-0 pb-[max(env(safe-area-inset-bottom),16px)]">
          <button
            type="button"
            onClick={() => handleQuickConfirm(activePopupItem.id)}
            disabled={confirmingId === activePopupItem.id}
            className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-60"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{confirmingId === activePopupItem.id ? 'Đang xác nhận...' : 'Chốt lịch ngay'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => snoozeAppointment(activePopupItem.id, 2)}
              className="min-h-[44px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Timer className="w-4 h-4 text-indigo-500" />
              <span>Hoãn nhắc 2 phút</span>
            </button>
            <button
              type="button"
              onClick={() => handleDismissPopupOrItem(activePopupItem.id)}
              className="min-h-[44px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-500" />
              <span>Đã xem (Ẩn)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        id="broadcast-alert-container"
        className="fixed bottom-[84px] md:bottom-5 right-3 sm:right-5 z-[95] max-w-lg w-[calc(100vw-1.5rem)] sm:w-[460px] flex flex-col gap-2.5 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        {/* Browser Autoplay Blocked Unlock Prompt */}
        {autoplayBlocked && (
          <button
            type="button"
            onClick={unlockSoundAndRetry}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-2xl shadow-xl border border-amber-400/50 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2 text-left">
              <VolumeX className="w-4 h-4 shrink-0" />
              <span>Thiết bị tạm chặn loa tự động — Chạm để bật âm thanh</span>
            </span>
            <span className="px-2.5 py-1 bg-white text-amber-700 rounded-lg text-xs font-bold shrink-0">
              Bật loa
            </span>
          </button>
        )}

        {/* Live Speaking Indicator Pill with Sequential Queue Counter */}
        {isPlaying && (
          <div className="bg-indigo-900/95 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md border border-indigo-500/30 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <Volume2 className="w-4 h-4 text-indigo-300 relative z-10" />
              </div>
              <div className="min-w-0">
                <div className="truncate">
                  <span className="font-semibold text-indigo-200 mr-2">Đang phát thanh:</span>
                  <span className="text-white font-medium truncate">
                    {currentPlayingTitle || 'Thông báo lịch hẹn...'}
                  </span>
                </div>
                {queueLength > 0 && (
                  <div className="text-[11px] text-indigo-200/90 mt-0.5">
                    Đang xếp hàng chờ phát nối tiếp: <strong>{queueLength}</strong> thông báo
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-3 bg-indigo-400 rounded-full animate-pulse"></span>
                <span className="w-1.5 h-4.5 bg-emerald-400 rounded-full animate-pulse delay-75"></span>
                <span className="w-1.5 h-3 bg-indigo-400 rounded-full animate-pulse delay-150"></span>
              </div>
              <button
                type="button"
                onClick={stopAllPlayback}
                title="Dừng phát thông báo hiện tại"
                className="p-1 rounded-lg hover:bg-indigo-800 text-indigo-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Compact Floating Cards when Popup Modal is closed */}
        {!activePopupItem &&
          activeItems.slice(0, 2).map((item) => {
            const isSnoozed = item.snoozeUntil && now < item.snoozeUntil;
            const remainingSnoozeSec = isSnoozed
              ? Math.max(0, Math.ceil((item.snoozeUntil! - now) / 1000))
              : 0;

            const elapsedSinceLastAnnounce = Math.floor((now - item.lastAnnouncedAt) / 1000);
            const secUntilNextReminder = Math.max(0, reminderIntervalSeconds - elapsedSinceLastAnnounce);

            return (
              <div
                key={item.id}
                id={`broadcast-item-${item.id}`}
                className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-2xl border-2 border-amber-400/80 ring-4 ring-amber-400/10 flex flex-col gap-3 transition-all"
              >
                {/* Header Badge & Countdown */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1 truncate">
                      <BellRing className="w-3 h-3 text-amber-600 shrink-0" />
                      {item.reminderCount > 0 ? `Nhắc lần ${item.reminderCount}` : 'Lịch mới chưa chốt'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPopup(item.id)}
                      title="Mở Popup chi tiết"
                      className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Mở Popup</span>
                    </button>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono bg-slate-100 px-2 py-1 rounded-lg">
                      {isSnoozed ? (
                        <>
                          <Timer className="w-3 h-3 text-indigo-500" />
                          <span>{Math.floor(remainingSnoozeSec / 60)}m{remainingSnoozeSec % 60}s</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{secUntilNextReminder}s</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient & Service Details */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                      {item.patientName}
                    </h4>
                    {item.patientPhone && (
                      <a
                        href={`tel:${item.patientPhone}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors shrink-0"
                        title="Gọi điện cho khách hàng"
                      >
                        <Phone className="w-3 h-3" />
                        {item.patientPhone}
                      </a>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded">
                      {item.serviceName}
                    </span>
                    <span className="text-slate-500">
                      <strong className="text-emerald-700">{formatTime(item.startAt)}</strong>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    id={`btn-confirm-${item.id}`}
                    onClick={() => handleQuickConfirm(item.id)}
                    disabled={confirmingId === item.id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{confirmingId === item.id ? 'Đang chốt...' : 'Chốt lịch ngay'}</span>
                  </button>

                  <button
                    id={`btn-snooze-${item.id}`}
                    onClick={() => snoozeAppointment(item.id, 2)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Tạm dừng nhắc nhở trong 2 phút"
                  >
                    <Timer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Hoãn 2p</span>
                  </button>

                  <button
                    id={`btn-dismiss-${item.id}`}
                    onClick={() => handleDismissPopupOrItem(item.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Đã xem (Dừng nhắc nhở)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

        {!activePopupItem && activeItems.length > 2 && (
          <button
            type="button"
            onClick={() => openPopup(activeItems[0].id)}
            className="w-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg text-center cursor-pointer"
          >
            Xem tất cả {activeItems.length} lịch hẹn mới đang chờ
          </button>
        )}
      </div>

      {popupModal && typeof document !== 'undefined' ? createPortal(popupModal, document.body) : null}
    </>
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

function formatClockOnly(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function formatDateLabel(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}
