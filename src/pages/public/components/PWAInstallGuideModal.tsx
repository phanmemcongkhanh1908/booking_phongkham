import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Monitor,
  X,
  Share,
  PlusSquare,
  Laptop,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  FileCode2,
  Sparkles,
  QrCode,
  ShieldCheck,
  ChevronDown,
  Package,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { useBookingStore } from '../../../store/booking';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicName: string;
  initialTab?: 'pc' | 'android' | 'ios';
  onInstalledOrCreated?: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  clinicName,
  initialTab,
  onInstalledOrCreated,
}) => {
  const {
    isInstallable,
    isIOS,
    isAndroid,
    isPC,
    isInAppBrowser,
    isIOSSafari,
    supportsFilePicker,
    install,
    saveHtmlDesktopLauncher,
    downloadBatAutoShortcutScript,
    getQuickPowerShellCommand,
    getAndroidInstallQrUrl,
    openInAndroidChrome,
    downloadAndroidApkBuilderScript,
    downloadAndroidTwaManifest,
  } = usePWAInstall();

  const clinicProfile = useBookingStore((s) => s.clinicProfile);
  const directApkUrl = clinicProfile?.directApkUrl?.trim() || '';
  const androidPackageName = clinicProfile?.androidPackageName?.trim() || '';
  const clinicSlug = clinicProfile?.slug?.trim() || '';

  const computedDefaultTab: 'pc' | 'android' | 'ios' =
    initialTab || (isPC ? 'pc' : isIOS ? 'ios' : 'android');
  const [activeTab, setActiveTab] = useState<'pc' | 'android' | 'ios'>(computedDefaultTab);
  const [copiedKey, setCopiedKey] = useState<'url' | 'ps' | null>(null);
  const [savingHtml, setSavingHtml] = useState(false);
  const [showApkPackager, setShowApkPackager] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || (isPC ? 'pc' : isIOS ? 'ios' : 'android'));
    }
  }, [isOpen, initialTab, isPC, isIOS]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pwa-guide-modal-toggle', { detail: { open: isOpen } }));
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.dispatchEvent(new CustomEvent('pwa-guide-modal-toggle', { detail: { open: false } }));
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const copyText = async (text: string, type: 'url' | 'ps', successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(type);
      toast.success(successMsg);
      setTimeout(() => setCopiedKey((prev) => (prev === type ? null : prev)), 2500);
    } catch {
      toast.error('Trình duyệt không cho phép sao chép tự động');
    }
  };

  const handleSaveHtmlLauncher = async () => {
    setSavingHtml(true);
    try {
      const res = await saveHtmlDesktopLauncher(clinicName);
      if (res.method === 'cancelled') return;
      if (res.ok) {
        toast.success(
          res.method === 'picker'
            ? 'Đã lưu Lối tắt mở nhanh ra Desktop! Nhấp đúp file để vào thẳng phòng khám.'
            : 'Đã tải Lối tắt (.html)! Kéo hoặc mở file vừa tải để vào thẳng phòng khám.'
        );
        onInstalledOrCreated?.();
      } else {
        toast.error('Không thể tạo lối tắt, vui lòng dùng cách cài qua trình duyệt.');
      }
    } finally {
      setSavingHtml(false);
    }
  };

  const handleDownloadBat = () => {
    const ok = downloadBatAutoShortcutScript(clinicName);
    if (ok) {
      toast.success(
        'Đang tải Script tự tạo Icon (.bat). Hãy mở file vừa tải để tự động gắn biểu tượng ra màn hình Desktop!',
        { duration: 5000 }
      );
      onInstalledOrCreated?.();
    } else {
      toast.error('Không thể tải script tự động.');
    }
  };

  const handleDownloadApkPackager = () => {
    const ok = downloadAndroidApkBuilderScript(clinicName, clinicSlug, androidPackageName);
    if (ok) {
      toast.success(
        'Đang tải bộ đóng gói APK (.bat). Mở file trên Windows để biên dịch & ký số app-release-signed.apk!',
        { duration: 6000 }
      );
    } else {
      toast.error('Không thể tạo script đóng gói APK.');
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const androidQrUrl = getAndroidInstallQrUrl() || currentUrl;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-unified-guide-title"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl bg-white shadow-2xl relative border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Fixed Header */}
        <div className="px-5 pt-5 pb-3.5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              {activeTab === 'pc' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 id="pwa-unified-guide-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                Cài đặt ứng dụng {clinicName}
              </h3>
              <p className="text-xs text-slate-500">
                Mở ứng dụng siêu tốc mọi lúc, không cần tìm hay quét lại QR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Platform Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('pc')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'pc' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Máy tính PC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'android' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>iPhone / iPad</span>
            </button>
          </div>

          {/* Content for PC */}
          {activeTab === 'pc' && (
            <div className="space-y-3.5 text-xs text-slate-700">
              {/* Option 1: Modern Native 1-Click PWA Install (No file download!) */}
              {isInstallable && (
                <div className="bg-teal-50/90 p-3.5 rounded-2xl border border-teal-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900 text-xs uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Hiện đại nhất (1 chạm — Không cần tải file):</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cài trực tiếp thành ứng dụng máy tính độc lập, tự động gắn biểu tượng ra màn hình Desktop ngay lập tức.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const accepted = await install();
                      if (accepted) {
                        toast.success('Đã cài Ứng dụng lên máy tính & Desktop thành công!');
                        onInstalledOrCreated?.();
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Thêm ứng dụng ra màn hình</span>
                  </button>
                </div>
              )}

              {/* Option 2: Windows .bat Auto-Shortcut Script & Win+R One-liner */}
              <div className="p-3.5 rounded-2xl border border-teal-200/80 bg-teal-50/40 space-y-2.5">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-teal-600" />
                  <span>Cài đặt nhanh trên PC (Tự tạo Icon Desktop):</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tải tệp kịch bản <strong>.bat</strong> chuyên dụng cho Windows: nhấp đúp để tự động tạo biểu tượng ứng dụng kèm logo ngay trên màn hình Desktop (hỗ trợ cả Desktop đồng bộ OneDrive).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadBat}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Cài đặt nhanh trên PC (.bat)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        getQuickPowerShellCommand(clinicName),
                        'ps',
                        'Đã sao chép lệnh! Bấm Win + R, dán (Ctrl + V) rồi Enter để tạo icon Desktop.'
                      )
                    }
                    className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'ps' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                    <span>{copiedKey === 'ps' ? 'Đã copy lệnh Win+R' : 'Copy lệnh Win + R'}</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 leading-snug">
                  Mẹo: Nếu Chrome / Edge / Cốc Cốc hiện cảnh báo bảo mật khi tải script, chọn <strong>&ldquo;Giữ (Keep)&rdquo;</strong> rồi nhấp đúp file; hoặc dùng nút <strong>Copy lệnh Win + R</strong> để chạy trực tiếp không cần tải tệp.
                </p>
              </div>

              {/* Option 3: Smart HTML Launcher (Zero .download error, direct Desktop picker!) */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Hoặc lưu Lối tắt mở thẳng (.html):</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {supportsFilePicker
                    ? 'Mở thẳng hộp thoại chọn thư mục Desktop để lưu lối tắt (.html), không bị lỗi .download hay chặn tải xuống.'
                    : 'Lưu tệp mở nhanh (.html) về máy, không bị lỗi .download, nhấp đúp là vào thẳng phòng khám!'}
                </p>
                <button
                  type="button"
                  disabled={savingHtml}
                  onClick={handleSaveHtmlLauncher}
                  className="w-full py-2 px-4 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-60 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-teal-600" />
                  <span>{savingHtml ? 'Đang tạo lối tắt...' : 'Lưu Lối tắt ra Màn hình Desktop (.html)'}</span>
                </button>
              </div>

              {/* Option 4: Browser Toolbar Steps */}
              <div className="space-y-2 pt-0.5">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                  Hoặc cài trực tiếp trên thanh công cụ trình duyệt:
                </p>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                    1
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Bấm biểu tượng <strong>[Cài đặt ứng dụng]</strong> (màn hình có mũi tên xuống) ở góc phải thanh địa chỉ URL, hoặc bấm Menu <strong>(⋮)</strong> ➔ <strong>&ldquo;Lưu và chia sẻ&rdquo;</strong> ➔ <strong>&ldquo;Tạo lối tắt...&rdquo;</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content for Android */}
          {activeTab === 'android' && (
            <div className="space-y-3 text-xs text-slate-700">
              {/* 1. Escape Zalo / Facebook In-App Browser with 1-tap Chrome Intent */}
              {isInAppBrowser && (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2.5">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Đang mở bên trong Zalo / Facebook</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Trình duyệt nhúng trong Zalo/Facebook chặn cài ứng dụng và thông báo đẩy. Bấm nút dưới đây để bật thẳng sang <strong>Google Chrome</strong>:
                  </p>
                  <div className="space-y-1.5">
                    {isAndroid && (
                      <button
                        type="button"
                        onClick={() => openInAndroidChrome()}
                        className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở ngay bằng Google Chrome</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(androidQrUrl, 'url', 'Đã sao chép đường dẫn! Hãy dán vào trình duyệt Chrome.')}
                      className="w-full py-2 px-3 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'url' ? 'Đã sao chép đường dẫn' : 'Hoặc sao chép link mở bằng Chrome'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Direct .APK Download Card (automatically shown if clinic configured directApkUrl) */}
              {directApkUrl && (
                <div className="bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                    <Package className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Tải file cài đặt trực tiếp cho Android (.APK)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Tải tệp <strong>.apk</strong> chính thức của <strong>{clinicName}</strong> về máy Android, mở file vừa tải và chọn <strong>Cài đặt</strong>.
                  </p>
                  <a
                    href={directApkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    onClick={() => {
                      toast.success('Đang tải file .APK! Sau khi tải xong hãy mở file để cài đặt.', { duration: 5000 });
                      onInstalledOrCreated?.();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải file cài đặt (.APK) về Android</span>
                  </a>
                </div>
              )}

              {/* 3. Native 1-Tap Chrome WebAPK (Google Minting Service — real Android APK, Push + OAuth supported) */}
              {isInstallable && (
                <div className="bg-teal-50 p-3.5 rounded-2xl border border-teal-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900 text-xs">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Cài App Android chính chủ (WebAPK 1 chạm)</span>
                  </div>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    Google Chrome tự đóng gói &amp; cài đặt trực tiếp vào danh sách Ứng dụng Android (không cảnh báo bảo mật, nhận đủ thông báo đẩy &amp; đăng nhập Google).
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const accepted = await install();
                      if (accepted) {
                        toast.success('Đã cài đặt App lên điện thoại Android thành công!');
                        onInstalledOrCreated?.();
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Cài App ra Màn hình chính ngay</span>
                  </button>
                </div>
              )}

              {/* 4. QR Code for installing on Android from PC or sharing */}
              {!isAndroid && androidQrUrl && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center gap-3.5">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                    <QRCodeCanvas value={androidQrUrl} size={78} level="M" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <QrCode className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>Quét trên điện thoại Android</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Mở Camera hoặc Chrome trên Android quét mã để vào thẳng chế độ cài App.
                    </p>
                    <button
                      type="button"
                      onClick={() => copyText(androidQrUrl, 'url', 'Đã sao chép link cài App Android!')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      {copiedKey === 'url' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'url' ? 'Đã copy link cài Android' : 'Copy link gửi sang điện thoại'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Manual Chrome / Samsung Internet 2-step guide */}
              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Mở Menu trình duyệt Chrome / Cốc Cốc / Samsung Internet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Nhấn biểu tượng <strong>3 chấm dọc (⋮)</strong> góc trên bên phải (hoặc <strong>≡</strong> dưới cùng trên Samsung Internet).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Chọn &ldquo;Cài đặt ứng dụng&rdquo; (WebAPK) hoặc &ldquo;Thêm vào MH chính&rdquo;</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bấm <strong>Cài đặt</strong> để Android tự đóng gói thành App độc lập của {clinicName} ngay trên màn hình chính.
                  </p>
                </div>
              </div>

              {/* 6. Expandable Technical Section: Export Real Signed .APK via Google Bubblewrap TWA */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowApkPackager((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-[11px] font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>Chủ phòng khám / Kỹ thuật: Đóng gói file .APK thật (Google TWA)</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showApkPackager ? 'rotate-180' : ''}`} />
                </button>

                {showApkPackager && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 space-y-2.5 text-[11px] text-slate-600 bg-slate-50/50">
                    <p className="leading-relaxed">
                      Theo chuẩn bảo mật Android, file <strong>.apk</strong> cài trực tiếp bắt buộc phải biên dịch mã Dalvik &amp; ký số bằng Keystore riêng (không thể giả lập file text như <code>.bat</code>). Dùng bộ đóng gói chuẩn <strong>Google Bubblewrap TWA</strong> trên máy tính để xuất ra file <code>app-release-signed.apk</code> giữ nguyên 100% Web Push &amp; đăng nhập Google:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadApkPackager}
                        className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>Tải Tool Đóng gói APK (.bat)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadAndroidTwaManifest(clinicName, clinicSlug, androidPackageName);
                          toast.success('Đã tải cấu hình twa-manifest.json!');
                        }}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileCode2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>Tải twa-manifest.json</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Sau khi tạo xong file <code>app-release-signed.apk</code>, bạn có thể gắn link file APK đó trong <strong>Quản trị ➔ Cài đặt ➔ Phát hành App Android</strong> để mọi điện thoại Android tải trực tiếp ngay tại đây!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content for iOS */}
          {activeTab === 'ios' && (
            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              {isInAppBrowser && (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Đang mở bên trong Zalo / Facebook</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Trên iPhone/iPad, bạn cần mở bằng <strong>Safari</strong> mới có nút Thêm vào màn hình chính. Bấm biểu tượng <strong>...</strong> hoặc Chia sẻ ở góc dưới/trên ➔ chọn <strong>&ldquo;Mở bằng Safari&rdquo;</strong>:
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(currentUrl, 'url', 'Đã sao chép đường dẫn! Hãy mở ứng dụng Safari và dán link.')}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'url' ? 'Đã sao chép đường dẫn' : 'Sao chép link để mở bằng Safari'}</span>
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">Bấm biểu tượng Chia sẻ</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Nhấn biểu tượng <Share className="w-3.5 h-3.5 text-blue-600 inline align-text-bottom mx-0.5" />{' '}
                    {isIOSSafari || !isIOS
                      ? 'ở thanh công cụ phía dưới của trình duyệt Safari.'
                      : 'ở góc trên bên phải thanh địa chỉ (hoặc chuyển sang Safari để ổn định nhất).'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">Chọn &ldquo;Thêm vào MH chính&rdquo;</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Cuộn xuống và chạm <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline align-text-bottom mx-0.5" />{' '}
                    <strong>&ldquo;Thêm vào MH chính&rdquo;</strong> (Add to Home Screen).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">Nhấn &ldquo;Thêm&rdquo; (Add)</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Biểu tượng <strong>{clinicName}</strong> sẽ xuất hiện ngay trên màn hình chính iPhone/iPad như một ứng dụng thực thụ.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
