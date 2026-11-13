import React, { useState } from 'react';
import {
  Smartphone,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Vibrate,
  Send,
  Loader2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useBroadcastStore } from '../../store/broadcastStore';
import { useVoiceStore } from '../../store/voiceStore';
import { ServerSpeechEngine } from '../../services/speech/ServerSpeechEngine';
import { useAdminMobileNotifications } from '../../hooks/useAdminMobileNotifications';
import toast from 'react-hot-toast';

interface MobileNotificationControlsProps {
  clinicName?: string;
  onClose?: () => void;
}

export default function MobileNotificationControls({
  clinicName = 'Phòng Khám',
  onClose,
}: MobileNotificationControlsProps) {
  const {
    enabled,
    setEnabled,
    autoChime,
    setAutoChime,
    mobilePopupEnabled,
    setMobilePopupEnabled,
    mobileVibrateEnabled,
    setMobileVibrateEnabled,
    testBroadcast,
  } = useBroadcastStore();

  const { setEnabled: setVoiceEnabled } = useVoiceStore();

  const {
    isInstalled,
    isInstallable,
    isIOS,
    isAndroid,
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

  const [showInstallSteps, setShowInstallSteps] = useState(false);
  const [helpNotice, setHelpNotice] = useState<'ios_install' | 'iframe' | 'denied' | null>(null);

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
        setShowInstallSteps(true);
      } else if (res.reason === 'iframe') {
        setHelpNotice('iframe');
      } else if (res.reason === 'denied') {
        setHelpNotice('denied');
      }
    }
  };

  const handleInstallClick = async () => {
    const res = await installAdminApp();
    if (!res.installed) {
      setShowInstallSteps((v) => !v);
    }
  };

  const handleToggleSpeech = (next: boolean) => {
    setEnabled(next);
    setVoiceEnabled(next);
    if (next) {
      ServerSpeechEngine.unlockAudio();
      toast.success('Đã bật phát thanh giọng đọc Tiếng Việt!');
    }
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Home Screen Installation for Clinic Manager (Android & iOS) */}
      <div
        className={`rounded-2xl border p-4 space-y-3 ${
          isInstalled
            ? 'bg-emerald-50/50 border-emerald-200'
            : 'bg-gradient-to-br from-teal-50/80 to-emerald-50/40 border-teal-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isInstalled ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'
              }`}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Cài trang Quản Trị ra Màn hình chính
                </h3>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> Đang chạy dạng App
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                    Android &amp; iPhone
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {isInstalled
                  ? `Bạn đang mở trang quản lý ${clinicName} trực tiếp từ màn hình chính. Sẵn sàng nhận thông báo đẩy tức thì.`
                  : 'Cài thành ứng dụng quản lý riêng trên điện thoại để mở nhanh 1 chạm và nhận thông báo đẩy ngay cả khi tắt trình duyệt (bắt buộc trên iOS iPhone).'}
              </p>
            </div>
          </div>
        </div>

        {!isInstalled && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 min-w-[200px] py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>
                {isInstallable
                  ? 'Cài App Quản Trị vào Điện thoại ngay'
                  : isIOS
                  ? 'Xem cách thêm vào MH chính iPhone'
                  : 'Hướng dẫn cài ra Màn hình chính'}
              </span>
            </button>
          </div>
        )}

        {(showInstallSteps || helpNotice === 'ios_install') && !isInstalled && (
          <div className="bg-white rounded-xl p-3.5 border border-teal-200/80 text-xs text-slate-700 space-y-2.5">
            {isIOS || helpNotice === 'ios_install' ? (
              <>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-teal-600" />
                  Hướng dẫn trên iPhone / iPad (Safari):
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                  <li>
                    Mở trang Quản Trị này bằng trình duyệt <strong>Safari</strong>.
                  </li>
                  <li>
                    Chạm nút <strong>Chia sẻ</strong>{' '}
                    <Share className="w-3.5 h-3.5 inline text-blue-600 mx-0.5" /> ở thanh dưới cùng màn hình.
                  </li>
                  <li>
                    Chọn <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mx-0.5" />{' '}
                    <strong>&ldquo;Thêm vào MH chính&rdquo; (Add to Home Screen)</strong> ➔ bấm <strong>Thêm</strong>.
                  </li>
                  <li>
                    Mở biểu tượng <strong>Quản Lý PK</strong> vừa tạo trên màn hình chính iPhone, sau đó bấm <strong>Bật Thông Báo Đẩy</strong> bên dưới.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-teal-600" />
                  Hướng dẫn trên {isAndroid ? 'Android (Chrome / Edge / Samsung)' : 'Điện thoại / Trình duyệt'}:
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                  <li>
                    Nhấn biểu tượng menu <strong>3 chấm dọc (⋮)</strong> ở góc trên bên phải trình duyệt.
                  </li>
                  <li>
                    Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong>.
                  </li>
                  <li>Xác nhận <strong>Cài đặt</strong> để đưa icon Quản Lý Phòng Khám ra màn hình điện thoại.</li>
                </ol>
              </>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Mobile OS Web Push Notifications (Lock Screen / Background) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isPushSubscribed ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">
                  Thông báo đẩy trên màn hình điện thoại
                </h4>
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
                Nhận thông báo bật sáng màn hình khi có khách mới đặt lịch tại phòng khám, kể cả khi thu nhỏ ứng dụng.
              </p>
            </div>
          </div>
        </div>

        {needsIOSHomeScreenInstall && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý cho iPhone / iPad:</strong> Apple yêu cầu phải <em>&ldquo;Thêm vào Màn hình chính&rdquo;</em> và mở app từ biểu tượng đó thì mới bật được Thông báo đẩy iOS.
            </span>
          </div>
        )}

        {helpNotice === 'iframe' && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
            <p className="font-semibold">
              Trình duyệt chặn cấp quyền thông báo bên trong khung xem trước. Hãy mở trang Quản Trị ở tab riêng để cấp quyền:
            </p>
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Mở Tab riêng
            </button>
          </div>
        )}

        {helpNotice === 'denied' && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
            Quyền thông báo đang bị trình duyệt đặt là <strong>Chặn</strong>. Hãy bấm vào biểu tượng ổ khóa 🔒 cạnh thanh địa chỉ URL (hoặc Cài đặt ứng dụng trên điện thoại) ➔ bật mục <strong>Thông báo (Notifications)</strong> sang <strong>Cho phép</strong> rồi tải lại trang.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={subscribing || !isPushSupported}
            className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
              isPushSubscribed
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
            }`}
          >
            {subscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>
              {!isPushSupported
                ? 'Thiết bị chưa hỗ trợ Push'
                : isPushSubscribed
                ? 'Tắt thông báo đẩy trên máy này'
                : 'Bật thông báo đẩy trên điện thoại'}
            </span>
          </button>

          {isPushSubscribed && (
            <button
              type="button"
              onClick={sendTestMobilePush}
              disabled={testingPush}
              className="py-2.5 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Gửi Push thử</span>
            </button>
          )}
        </div>
      </div>

      {/* Section 3: Mobile Popup & Voice Broadcast Preferences */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Tuỳ chọn Popup &amp; Phát thanh trên thiết bị
        </h4>

        <div className="divide-y divide-slate-100">
          {/* Option 1: Screen Popup Modal */}
          <label className="py-2.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5 min-w-0">
              <MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Hiện Popup cảnh báo nổi trên màn hình
                </p>
                <p className="text-[11px] text-slate-500">
                  Bật hộp thoại chi tiết khách đặt lịch ngay khi có khách hẹn mới để chốt lịch 1 chạm
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={mobilePopupEnabled}
              onChange={(e) => setMobilePopupEnabled(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Option 2: Vietnamese Voice Broadcast */}
          <label className="py-2.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5 min-w-0">
              {enabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Phát âm thanh &amp; Giọng đọc Tiếng Việt
                </p>
                <p className="text-[11px] text-slate-500">
                  Đọc to tên khách hàng, dịch vụ, bác sĩ và giờ khám qua loa điện thoại / máy tính
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggleSpeech(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Option 3: Warning Chime */}
          <label className="py-2.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Nhạc hiệu cảnh báo trước khi đọc
                </p>
                <p className="text-[11px] text-slate-500">
                  Phát chuông 4 nốt thu hút sự chú ý trước khi phát giọng đọc
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoChime}
              onChange={(e) => setAutoChime(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Option 4: Mobile Vibration */}
          <label className="py-2.5 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-start gap-2.5 min-w-0">
              <Vibrate className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Rung điện thoại khi có lịch mới (Android)
                </p>
                <p className="text-[11px] text-slate-500">
                  Rung cảnh báo khi màn hình quản trị đang mở (kể cả khi bật chế độ im lặng)
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={mobileVibrateEnabled}
              onChange={(e) => setMobileVibrateEnabled(e.target.checked)}
              className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            testBroadcast({ withPopup: true });
          }}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Hiện Popup mẫu &amp; Phát thanh thử ngay</span>
        </button>
      </div>
    </div>
  );
}
