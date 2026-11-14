import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe,
  HardDrive,
  Laptop,
  Loader2,
  MessageSquare,
  PlayCircle,
  PlusSquare,
  RefreshCw,
  RotateCw,
  Send,
  Share,
  Smartphone,
  Sparkles,
  Trash2,
  Vibrate,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import { useBroadcastStore } from '../../store/broadcastStore';
import { useVoiceStore, VoiceMode } from '../../store/voiceStore';
import { ServerSpeechEngine } from '../../services/speech/ServerSpeechEngine';
import { BrowserSpeechEngine, LocalVoiceInfo } from '../../services/speech/BrowserSpeechEngine';
import {
  OfflineVoicePackService,
  OfflinePackMetadata,
  OfflinePackProgress,
} from '../../services/speech/OfflineVoicePackService';
import { useAdminMobileNotifications } from '../../hooks/useAdminMobileNotifications';
import { detectDevicePlatform } from '../../utils/devicePlatform';
import toast from 'react-hot-toast';

interface NotificationBroadcastHubProps {
  clinicName?: string;
  variant?: 'full' | 'modal';
  onClose?: () => void;
}

function formatPackSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '~1 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function NotificationBroadcastHub({
  clinicName = 'Phòng Khám',
  variant = 'full',
  onClose,
}: NotificationBroadcastHubProps) {
  const device = useMemo(() => detectDevicePlatform(), []);

  const {
    enabled,
    setEnabled,
    autoChime,
    setAutoChime,
    mobilePopupEnabled,
    setMobilePopupEnabled,
    mobileVibrateEnabled,
    setMobileVibrateEnabled,
    reminderIntervalSeconds,
    setReminderIntervalSeconds,
    maxReminders,
    setMaxReminders,
    volume,
    setVolume,
    isPlaying,
    queueLength,
    testBroadcast,
  } = useBroadcastStore();

  const {
    setEnabled: setVoiceEnabled,
    setVolume: setVoiceVolume,
    voiceMode,
    setVoiceMode,
    preferredVoiceURI,
    setPreferredVoiceURI,
  } = useVoiceStore();

  const {
    isInstalled,
    isInstallable,
    isPushSupported,
    isPushSubscribed,
    permissionState,
    needsIOSHomeScreenInstall,
    isInIframe,
    subscribing,
    testingPush,
    enableMobilePush,
    disableMobilePush,
    sendTestMobilePush,
    installAdminApp,
  } = useAdminMobileNotifications();

  const [helpNotice, setHelpNotice] = useState<'ios_install' | 'iframe' | 'denied' | null>(null);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [showAndroidFallbackSteps, setShowAndroidFallbackSteps] = useState(false);

  // Offline voice pack state
  const [packMeta, setPackMeta] = useState<OfflinePackMetadata | null>(() =>
    OfflineVoicePackService.getMetadata()
  );
  const [installingPack, setInstallingPack] = useState(false);
  const [installProgress, setInstallProgress] = useState<OfflinePackProgress | null>(null);
  const [testingOffline, setTestingOffline] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [localVoices, setLocalVoices] = useState<LocalVoiceInfo[]>([]);

  const scanLocalVoices = useCallback(async () => {
    try {
      await BrowserSpeechEngine.waitForVoices(900);
      const found = BrowserSpeechEngine.getVietnameseVoices();
      setLocalVoices(found);
      if (found.length > 0 && !preferredVoiceURI) {
        setPreferredVoiceURI(found[0].voiceURI);
      }
    } catch {}
  }, [preferredVoiceURI, setPreferredVoiceURI]);

  useEffect(() => {
    scanLocalVoices();
    OfflineVoicePackService.verifyCacheIntegrity().then((ok) => {
      if (!ok && OfflineVoicePackService.isInstalled()) {
        setPackMeta(null);
      } else {
        setPackMeta(OfflineVoicePackService.getMetadata());
      }
    });
  }, [scanLocalVoices]);

  const handleToggleSpeech = (next: boolean) => {
    setEnabled(next);
    setVoiceEnabled(next);
    if (next) {
      ServerSpeechEngine.unlockAudio();
      toast.success('Đã bật phát thanh giọng đọc Tiếng Việt!');
    }
  };

  const handleTogglePush = async () => {
    setHelpNotice(null);
    if (isPushSubscribed) {
      await disableMobilePush();
      return;
    }
    const res = await enableMobilePush();
    if (!res.ok) {
      if (res.reason === 'ios_install_required') {
        setHelpNotice('ios_install');
        setShowIOSSteps(true);
      } else if (res.reason === 'iframe') {
        setHelpNotice('iframe');
      } else if (res.reason === 'denied') {
        setHelpNotice('denied');
      }
    }
  };

  const handleInstallAppClick = async () => {
    const res = await installAdminApp();
    if (!res.installed) {
      if (device.isIOS) {
        setShowIOSSteps((v) => !v);
      } else if (device.isAndroid) {
        setShowAndroidFallbackSteps((v) => !v);
      }
    }
  };

  const handleInstallOfflinePack = async () => {
    if (installingPack) return;
    setInstallingPack(true);
    setInstallProgress({ loaded: 0, total: 100, percent: 0, currentLabel: 'Đang kết nối...' });
    try {
      const res = await OfflineVoicePackService.installOfflinePack((prog) => {
        setInstallProgress(prog);
      });
      if (res.ok && res.meta) {
        setPackMeta(res.meta);
        toast.success(`Đã cài xong Gói Tiếng Việt Offline (${res.meta.clipCount} mẫu âm thanh)!`);
      } else {
        toast.error(res.error || 'Chưa thể tải gói giọng Offline lúc này.');
      }
    } finally {
      setInstallingPack(false);
      setInstallProgress(null);
    }
  };

  const handleUninstallOfflinePack = async () => {
    await OfflineVoicePackService.uninstallOfflinePack();
    setPackMeta(null);
    toast.success('Đã gỡ bỏ Gói giọng Tiếng Việt Offline khỏi trình duyệt.');
  };

  const handleTestOfflineVoice = async () => {
    if (testingOffline) return;
    setTestingOffline(true);
    try {
      const res = await ServerSpeechEngine.testOfflineVoice(autoChime, preferredVoiceURI);
      if (!res.ok) {
        toast.error('Vui lòng cài đặt Gói Tiếng Việt Offline trước khi nghe thử.');
      } else {
        toast.success(
          res.source === 'offline_pack'
            ? 'Đang phát từ Gói Tiếng Việt Offline tích hợp!'
            : 'Đang phát từ giọng Tiếng Việt Offline trên thiết bị!'
        );
      }
    } finally {
      setTimeout(() => setTestingOffline(false), 700);
    }
  };

  const handleTestAll = async () => {
    if (testingAll) return;
    setTestingAll(true);
    try {
      if (variant === 'modal' && onClose) {
        onClose();
      }
      await testBroadcast({ withPopup: true });
      toast.success('Đã phát thanh thử nghiệm & hiện Popup mẫu!');
    } finally {
      setTimeout(() => setTestingAll(false), 600);
    }
  };

  // Determine whether we should show the PWA App Install card for THIS exact device
  const shouldShowInstallSection =
    isInstalled ||
    device.isIOS ||
    device.isAndroid ||
    (device.isDesktop && isInstallable);

  return (
    <div id="voice-settings-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
      {/* Unified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Thông báo &amp; Phát thanh Phòng khám
              </h2>
              {isPlaying && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                  Đang phát {queueLength > 0 ? `(+${queueLength})` : ''}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Cài đặt duy nhất tại đây cho thiết bị đang dùng — nhạc hiệu, giọng đọc Tiếng Việt Online/Offline &amp; thông báo đẩy.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold shrink-0 self-start sm:self-center">
          {device.isMobile ? <Smartphone className="w-3.5 h-3.5 text-teal-600" /> : <Laptop className="w-3.5 h-3.5 text-teal-600" />}
          <span>{device.deviceLabel}</span>
        </span>
      </div>

      {/* Block 1: Device Push Notification + Device-Specific Install (Only relevant to THIS device) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Push Notification Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isPushSubscribed ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                <BellRing className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900">
                    {device.isMobile ? 'Thông báo đẩy trên điện thoại' : 'Thông báo trên trình duyệt máy tính'}
                  </h3>
                  {isPushSubscribed ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                      Đang bật
                    </span>
                  ) : permissionState === 'denied' ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                      Đang bị chặn
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      Chưa bật
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {device.isMobile
                    ? 'Bật sáng màn hình và hiện thông báo ngay cả khi thu nhỏ ứng dụng.'
                    : `Hiện thông báo tức thì trên ${device.osLabel} (${device.browserLabel}) khi có khách đặt lịch mới.`}
                </p>
              </div>
            </div>

            {device.isIOS && needsIOSHomeScreenInstall && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Trên iPhone/iPad, bạn cần thêm trang này ra <strong>Màn hình chính</strong> trước khi bật thông báo đẩy iOS.
                </span>
              </div>
            )}

            {helpNotice === 'iframe' && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-2">
                <span>Mở ở tab trình duyệt riêng để cấp quyền thông báo:</span>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" /> Mở Tab
                </button>
              </div>
            )}

            {(helpNotice === 'denied' || permissionState === 'denied') && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                Trình duyệt đang chặn quyền Thông báo. Hãy bấm biểu tượng ổ khóa 🔒 trên thanh địa chỉ ➔ chọn <strong>Thông báo: Cho phép</strong> rồi tải lại trang.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={subscribing || !isPushSupported}
              className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                isPushSubscribed
                  ? 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
            >
              {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              <span>
                {!isPushSupported
                  ? 'Trình duyệt không hỗ trợ Push'
                  : isPushSubscribed
                  ? 'Tắt thông báo trên máy này'
                  : device.isMobile
                  ? 'Bật thông báo đẩy điện thoại'
                  : 'Bật thông báo trên máy tính'}
              </span>
            </button>

            {isPushSubscribed && (
              <button
                type="button"
                onClick={sendTestMobilePush}
                disabled={testingPush}
                className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Gửi thử</span>
              </button>
            )}
          </div>
        </div>

        {/* Device-Specific App Install Card OR Quick Toggles Summary */}
        {shouldShowInstallSection ? (
          <div
            className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
              isInstalled ? 'bg-emerald-50/40 border-emerald-200' : 'bg-teal-50/40 border-teal-200'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isInstalled ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'
                  }`}
                >
                  {device.isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      {device.isIOS
                        ? 'Cài App Quản Trị lên iPhone / iPad'
                        : device.isAndroid
                        ? 'Cài App Quản Trị lên Android'
                        : `Cài ứng dụng vào ${device.osLabel}`}
                    </h3>
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Đang chạy dạng App
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {isInstalled
                      ? `Bạn đang mở trang quản lý ${clinicName} dưới dạng ứng dụng độc lập.`
                      : device.isIOS
                      ? 'Thêm biểu tượng ra màn hình chính iPhone để mở 1 chạm và nhận thông báo đẩy Apple iOS.'
                      : device.isAndroid
                      ? 'Cài icon Quản Lý Phòng Khám ra màn hình chính Android để truy cập tức thì.'
                      : 'Cài trang quản trị thành cửa sổ ứng dụng riêng trên máy tính để thao tác nhanh hơn.'}
                  </p>
                </div>
              </div>

              {!isInstalled && device.isIOS && showIOSSteps && (
                <div className="bg-white rounded-xl p-3 border border-teal-200 text-xs text-slate-700 space-y-1.5">
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Mở trang này bằng <strong>Safari</strong>, bấm biểu tượng <strong>Chia sẻ</strong>{' '}
                      <Share className="w-3.5 h-3.5 inline text-blue-600" /> ở thanh dưới cùng.
                    </li>
                    <li>
                      Chọn <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />{' '}
                      <strong>&ldquo;Thêm vào MH chính&rdquo;</strong> ➔ bấm <strong>Thêm</strong>.
                    </li>
                  </ol>
                </div>
              )}

              {!isInstalled && device.isAndroid && showAndroidFallbackSteps && (
                <div className="bg-white rounded-xl p-3 border border-teal-200 text-xs text-slate-700 space-y-1.5">
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Bấm biểu tượng menu <strong>3 chấm dọc (⋮)</strong> góc trên bên phải {device.browserLabel}.</li>
                    <li>Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong>.</li>
                  </ol>
                </div>
              )}
            </div>

            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallAppClick}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isInstallable
                    ? `Cài App lên ${device.osLabel} ngay`
                    : device.isIOS
                    ? showIOSSteps
                      ? 'Ẩn hướng dẫn iPhone'
                      : 'Xem cách thêm vào MH chính iPhone'
                    : showAndroidFallbackSteps
                    ? 'Ẩn hướng dẫn Android'
                    : 'Xem cách cài trên Android'}
                </span>
              </button>
            )}
          </div>
        ) : (
          /* Desktop when already accessible via browser tab (no unnecessary install prompt shown) */
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cơ chế xếp hàng phát thanh an toàn
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Khi nhiều khách hàng cùng đặt lịch, hệ thống sẽ phát tuần tự từng bản tin (Nhạc hiệu ➔ Giọng Tiếng Việt), không bao giờ phát chồng lấn âm thanh và tự dừng nhắc khi đã chốt lịch.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestAll}
              disabled={testingAll}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {testingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4 text-emerald-300" />}
              <span>Hiện Popup mẫu &amp; Nghe thử ngay</span>
            </button>
          </div>
        )}
      </div>

      {/* Block 2: Consolidated Notification & Sound Toggles (Single Source of Truth) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 pb-1">
          Tùy chọn Popup &amp; Âm thanh trên {device.isMobile ? 'điện thoại' : 'máy tính'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Toggle 1: Popup */}
          <label className="flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 cursor-pointer hover:border-teal-300 transition-colors">
            <div className="flex items-start gap-2.5 min-w-0">
              <MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Hiện Popup cảnh báo nổi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Bật hộp thoại chi tiết khách hẹn để chốt lịch 1 chạm</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={mobilePopupEnabled}
              onChange={(e) => setMobilePopupEnabled(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Toggle 2: Master Speech */}
          <label className="flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 cursor-pointer hover:border-emerald-300 transition-colors">
            <div className="flex items-start gap-2.5 min-w-0">
              {enabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Phát giọng đọc Tiếng Việt</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Đọc to tên khách, dịch vụ, bác sĩ và giờ khám</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggleSpeech(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Toggle 3: Chime */}
          <label className="flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 cursor-pointer hover:border-indigo-300 transition-colors">
            <div className="flex items-start gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Nhạc hiệu cảnh báo trước khi đọc</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Phát chuông 4 nốt trước mỗi thông báo rồi mới đọc</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoChime}
              onChange={(e) => setAutoChime(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Toggle 4: Vibration (STRICTLY shown ONLY on Android devices) */}
          {device.supportsVibration && (
            <label className="flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 cursor-pointer hover:border-amber-300 transition-colors">
              <div className="flex items-start gap-2.5 min-w-0">
                <Vibrate className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">Rung điện thoại khi có lịch mới</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Rung cảnh báo trên Android khi đang mở ứng dụng</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={mobileVibrateEnabled}
                onChange={(e) => setMobileVibrateEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
              />
            </label>
          )}
        </div>
      </div>

      {/* Block 3: Built-In 1-Click Offline Vietnamese Voice Pack & Mode */}
      <div className={`space-y-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        {/* Voice Source Mode */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Globe className="w-4 h-4 text-teal-600" />
              <span>Nguồn giọng đọc Tiếng Việt (Miễn phí 100%)</span>
            </div>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              Tự động dự phòng Online / Offline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(
              [
                {
                  id: 'auto' as VoiceMode,
                  title: 'Tự động (Khuyên dùng)',
                  desc: 'Phát giọng Online chuẩn; tự chuyển sang Gói Offline tích hợp nếu mất mạng.',
                },
                {
                  id: 'offline_first' as VoiceMode,
                  title: 'Ưu tiên Gói Offline',
                  desc: 'Phát ngay từ gói Tiếng Việt đã tải trong ứng dụng (0ms độ trễ, không tốn mạng).',
                },
                {
                  id: 'online_only' as VoiceMode,
                  title: 'Giọng Online Máy chủ',
                  desc: 'Luôn phát MP3 Tiếng Việt chất lượng cao từ máy chủ miễn phí.',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVoiceMode(opt.id)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  voiceMode === opt.id
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/15 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                  {voiceMode === opt.id && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Built-in 1-Click Installable Offline Vietnamese Voice Pack */}
        <div
          className={`p-4 rounded-2xl border space-y-3 ${
            packMeta?.installed
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-indigo-200 bg-indigo-50/35'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  packMeta?.installed ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-900">
                    Gói giọng đọc Tiếng Việt Offline tích hợp sẵn
                  </h4>
                  {packMeta?.installed ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      Đã cài ({packMeta.clipCount} mẫu • {formatPackSize(packMeta.sizeBytes)})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                      1 chạm cài ngay • Miễn phí
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {packMeta?.installed
                    ? 'Ứng dụng đã lưu sẵn các câu thông báo, giờ hẹn, tên phổ biến và danh sách dịch vụ/bác sĩ để phát thanh ngay cả khi mất Internet.'
                    : 'Chỉ cần bấm 1 nút để tải sẵn gói giọng Tiếng Việt chuẩn vào trình duyệt, hoạt động ngay không cần cài đặt phức tạp trên máy.'}
                </p>
              </div>
            </div>

            {!packMeta?.installed ? (
              <button
                type="button"
                onClick={handleInstallOfflinePack}
                disabled={installingPack}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0 disabled:opacity-60"
              >
                {installingPack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{installingPack ? 'Đang tải gói Offline...' : 'Tải & Cài gói Offline ngay'}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestOfflineVoice}
                  disabled={testingOffline || installingPack}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {testingOffline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  <span>Nghe thử Offline</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstallOfflinePack}
                  disabled={installingPack}
                  title="Cập nhật thêm tên dịch vụ và bác sĩ mới nhất của phòng khám"
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${installingPack ? 'animate-spin' : ''}`} />
                  <span>Cập nhật</span>
                </button>
                <button
                  type="button"
                  onClick={handleUninstallOfflinePack}
                  disabled={installingPack}
                  title="Xóa gói giọng Offline khỏi bộ nhớ trình duyệt"
                  className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-500 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {installingPack && installProgress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800">
                <span className="truncate max-w-[70%]">
                  Đang nạp: {installProgress.currentLabel || 'âm thanh Tiếng Việt'}
                </span>
                <span>
                  {installProgress.loaded}/{installProgress.total} ({installProgress.percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-200">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{ width: `${installProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {localVoices.length > 0 && (
            <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 shrink-0">
                Giọng hệ thống dự phòng ({localVoices.length}):
              </span>
              <select
                value={preferredVoiceURI || localVoices[0]?.voiceURI || ''}
                onChange={(e) => setPreferredVoiceURI(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {localVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Block 4: Reminders + Volume + Action Button */}
        {variant === 'full' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Tự động nhắc lại nếu chưa chốt lịch</span>
              </label>
              <select
                value={reminderIntervalSeconds}
                onChange={(e) => setReminderIntervalSeconds(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value={30}>30 giây (Giờ cao điểm)</option>
                <option value={60}>60 giây (Khuyến nghị tiêu chuẩn)</option>
                <option value={90}>90 giây</option>
                <option value={120}>2 phút</option>
                <option value={180}>3 phút</option>
                <option value={300}>5 phút</option>
                <option value={0}>Tắt tự động nhắc lại</option>
              </select>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-indigo-600" />
                <span>Số lần nhắc nhở tối đa</span>
              </label>
              <select
                value={maxReminders}
                onChange={(e) => setMaxReminders(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value={1}>1 lần nhắc</option>
                <option value={3}>3 lần nhắc</option>
                <option value={5}>5 lần nhắc (Khuyến nghị)</option>
                <option value={10}>10 lần nhắc</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2 block">
              Âm lượng phát thanh: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                setVoiceVolume(val);
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <button
            id="btn-test-broadcast"
            type="button"
            onClick={handleTestAll}
            disabled={testingAll}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {testingAll ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang phát nhạc hiệu &amp; giọng đọc...</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                <span>Hiện Popup mẫu &amp; Nghe thử Nhạc hiệu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
