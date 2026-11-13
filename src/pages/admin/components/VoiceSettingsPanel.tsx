import React, { useEffect, useState, useCallback } from 'react';
import {
  Volume2,
  PlayCircle,
  Loader2,
  Clock,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Laptop,
  Smartphone,
  Globe,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Bell,
} from 'lucide-react';
import { useVoiceStore, VoiceMode } from '../../../store/voiceStore';
import { useBroadcastStore } from '../../../store/broadcastStore';
import { ServerSpeechEngine } from '../../../services/speech/ServerSpeechEngine';
import { BrowserSpeechEngine, LocalVoiceInfo } from '../../../services/speech/BrowserSpeechEngine';
import MobileNotificationControls from '../../../components/admin/MobileNotificationControls';
import toast from 'react-hot-toast';

export default function VoiceSettingsPanel() {
  const {
    enabled,
    setEnabled,
    volume,
    setVolume,
    voiceMode,
    setVoiceMode,
    preferredVoiceURI,
    setPreferredVoiceURI,
  } = useVoiceStore();

  const {
    reminderIntervalSeconds,
    setReminderIntervalSeconds,
    maxReminders,
    setMaxReminders,
    autoChime,
    setAutoChime,
    isPlaying,
    queueLength,
    testBroadcast,
  } = useBroadcastStore();

  const [ttsStatus, setTtsStatus] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testingOffline, setTestingOffline] = useState(false);
  const [localVoices, setLocalVoices] = useState<LocalVoiceInfo[]>([]);
  const [scanningVoices, setScanningVoices] = useState(true);
  const [showOfflineGuide, setShowOfflineGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<'windows' | 'mac' | 'mobile' | 'browser'>('windows');

  const scanLocalVoices = useCallback(async () => {
    setScanningVoices(true);
    try {
      await BrowserSpeechEngine.waitForVoices(1200);
      const found = BrowserSpeechEngine.getVietnameseVoices();
      setLocalVoices(found);
      if (found.length > 0 && !preferredVoiceURI) {
        setPreferredVoiceURI(found[0].voiceURI);
      }
    } finally {
      setScanningVoices(false);
    }
  }, [preferredVoiceURI, setPreferredVoiceURI]);

  useEffect(() => {
    fetch('/api/tts/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTtsStatus(data.data);
        }
      })
      .catch((err) => console.error('Could not fetch TTS status', err));

    scanLocalVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const onVoicesChanged = () => {
        setLocalVoices(BrowserSpeechEngine.getVietnameseVoices());
      };
      try {
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      } catch {}
    }
  }, [scanLocalVoices]);

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await testBroadcast();
      toast.success('Đã đưa thông báo thử nghiệm vào hàng đợi phát thanh!');
    } finally {
      setTimeout(() => setTesting(false), 600);
    }
  };

  const handleTestOfflineVoice = async () => {
    if (testingOffline) return;
    setTestingOffline(true);
    try {
      ServerSpeechEngine.unlockAudio();
      if (autoChime) {
        await ServerSpeechEngine.playChime();
      }
      const res = await BrowserSpeechEngine.speakVietnamese(
        'Kiểm tra giọng đọc tiếng Việt ngoại tuyến trên thiết bị của bạn. Âm thanh rõ ràng và sẵn sàng hoạt động.',
        { requireVietnameseVoice: true, preferredVoiceURI }
      );
      if (!res.spoken) {
        setShowOfflineGuide(true);
        toast.error('Thiết bị chưa có gói giọng đọc Tiếng Việt Offline. Vui lòng xem hướng dẫn cài đặt miễn phí bên dưới.');
      }
    } finally {
      setTestingOffline(false);
    }
  };

  const hasOfflineVietnamese = localVoices.length > 0;

  return (
    <div id="voice-settings-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Phát thanh thông báo &amp; Nhắc nhở lịch hẹn</h2>
            <p className="text-sm text-slate-500">
              Nhạc hiệu cảnh báo trước khi đọc, phát nối tiếp theo hàng đợi (không chồng lấn), hỗ trợ giọng Tiếng Việt Online &amp; Offline miễn phí 100%
            </p>
          </div>
        </div>
        {isPlaying && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            Đang phát {queueLength > 0 ? `(+${queueLength} chờ)` : ''}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Mobile Phone (Android/iOS) Home Screen Install + Push + Popup Controls */}
        <MobileNotificationControls />

        {/* Master Toggle + Chime Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="pr-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                <span>Trợ lý phát thanh phòng khám</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Free 100%
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Phát nhạc hiệu &amp; đọc thông tin khách hàng khi có lịch hẹn mới
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setEnabled(val);
                  useBroadcastStore.getState().setEnabled(val);
                  if (val) {
                    ServerSpeechEngine.unlockAudio();
                  }
                }}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="pr-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span>Nhạc hiệu cảnh báo đầu bản tin</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Phát chuông 4 nốt trước mỗi thông báo rồi mới đọc giọng tiếng Việt
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoChime}
                onChange={(e) => setAutoChime(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        <div className={`transition-all duration-300 space-y-6 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          {/* Voice Source Strategy Selector (100% Free Online + Offline Hybrid) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-800 font-semibold">
                <Globe className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Chế độ nguồn giọng đọc Tiếng Việt (Miễn phí 100%)</span>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                {ttsStatus?.providers?.join(', ') || 'Google Voice Tiếng Việt Chuẩn (Tất cả thiết bị)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'auto' as VoiceMode,
                    title: 'Tự động (Khuyên dùng)',
                    desc: 'Phát giọng Online Miễn Phí chuẩn mọi PC/trình duyệt; tự chuyển sang Offline nếu mất mạng.',
                  },
                  {
                    id: 'offline_first' as VoiceMode,
                    title: 'Ưu tiên Giọng Offline',
                    desc: 'Dùng gói Tiếng Việt cài sẵn trên máy (0ms độ trễ); tự dùng Online nếu máy chưa cài.',
                  },
                  {
                    id: 'online_only' as VoiceMode,
                    title: 'Giọng Online Máy chủ',
                    desc: 'Luôn phát MP3 Tiếng Việt chuẩn từ máy chủ miễn phí trên mọi thiết bị.',
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
                      : 'bg-white/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                    {voiceMode === opt.id && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Local Offline Vietnamese Voice Pack Checker + Install Guide */}
          <div
            className={`p-4 rounded-xl border ${
              hasOfflineVietnamese
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-amber-200 bg-amber-50/50'
            } space-y-3`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {hasOfflineVietnamese ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className={hasOfflineVietnamese ? 'text-emerald-900' : 'text-amber-900'}>
                  {scanningVoices
                    ? 'Đang kiểm tra gói giọng đọc Tiếng Việt trên máy...'
                    : hasOfflineVietnamese
                    ? `Thiết bị đã có ${localVoices.length} giọng đọc Tiếng Việt khả dụng`
                    : 'Máy tính/Trình duyệt chưa có gói giọng đọc Tiếng Việt Offline'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={scanLocalVoices}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningVoices ? 'animate-spin' : ''}`} />
                  <span>Kiểm tra lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfflineGuide((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-indigo-700 rounded-lg cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Hướng dẫn cài gói Offline (Free)</span>
                  {showOfflineGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {hasOfflineVietnamese ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <select
                  value={preferredVoiceURI || localVoices[0]?.voiceURI || ''}
                  onChange={(e) => setPreferredVoiceURI(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-emerald-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {localVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.localService ? '• Offline trên máy' : '• Trình duyệt'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTestOfflineVoice}
                  disabled={testingOffline}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {testingOffline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  <span>Nghe thử giọng Offline</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-800 leading-relaxed">
                Không sao cả! Chế độ <strong>Tự động / Online Miễn Phí 100%</strong> vẫn đang phát tiếng Việt chuẩn trên máy này. Tuy nhiên bạn có thể cài thêm <strong>Gói giọng Tiếng Việt Offline miễn phí</strong> (chỉ 1 phút) để máy vẫn đọc tốt ngay cả khi mạng chập chờn.
              </p>
            )}

            {/* Step-by-step Free Offline Voice Pack Installation Guide */}
            {showOfflineGuide && (
              <div className="mt-3 pt-3 border-t border-slate-200/70 bg-white rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'windows', label: 'Windows 10 / 11', icon: Laptop },
                      { id: 'mac', label: 'macOS', icon: Laptop },
                      { id: 'mobile', label: 'Android / iPhone', icon: Smartphone },
                      { id: 'browser', label: 'Chrome / Edge / Cốc Cốc', icon: Globe },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setGuideTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          guideTab === tab.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {guideTab === 'windows' && (
                  <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                    <p className="font-bold text-slate-900">Cài giọng đọc Tiếng Việt Offline chính hãng Microsoft (Miễn phí 100%):</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Mở <strong>Settings</strong> (phím tắt <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border">Win + I</kbd>) ➔ chọn <strong>Time &amp; language</strong> ➔ <strong>Language &amp; region</strong>.</li>
                      <li>Bấm <strong>Add a language</strong> ➔ tìm <strong>Vietnamese (Tiếng Việt)</strong> ➔ bấm <strong>Next</strong>.</li>
                      <li>Tick chọn mục <strong>Text-to-speech</strong> (Chuyển văn bản thành giọng nói) rồi bấm <strong>Install</strong> (khoảng 30MB, hoàn toàn miễn phí).</li>
                      <li>Hoặc vào <strong>Time &amp; language ➔ Speech ➔ Manage voices ➔ Add voices</strong> ➔ chọn <strong>Vietnamese (Vietnam)</strong> (giọng <em>Microsoft An</em> / <em>HoaiMy</em>).</li>
                      <li>Sau khi tải xong, khởi động lại trình duyệt và bấm nút <strong>Kiểm tra lại</strong> ở trên.</li>
                    </ol>
                  </div>
                )}

                {guideTab === 'mac' && (
                  <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                    <p className="font-bold text-slate-900">Tải giọng đọc Tiếng Việt trên MacBook / iMac (Miễn phí 100%):</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Mở <strong>System Settings</strong> (Cài đặt hệ thống) ➔ chọn <strong>Accessibility</strong> (Trợ năng).</li>
                      <li>Chọn mục <strong>Spoken Content</strong> (Nội dung được đọc).</li>
                      <li>Tại dòng <strong>System Voice</strong> ➔ bấm <strong>Manage Voices...</strong>.</li>
                      <li>Tìm mục <strong>Vietnamese</strong> ➔ bấm biểu tượng tải xuống giọng <strong>Linh</strong> (bản Enhanced chất lượng cao, miễn phí).</li>
                      <li>Bấm <strong>Kiểm tra lại</strong> ở trên sau khi tải hoàn tất.</li>
                    </ol>
                  </div>
                )}

                {guideTab === 'mobile' && (
                  <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                    <p className="font-bold text-slate-900">Bật gói giọng đọc Tiếng Việt trên điện thoại / máy tính bảng:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Android:</strong> Vào <em>Cài đặt ➔ Hệ thống / Quản lý chung ➔ Chuyển văn bản thành giọng nói</em> ➔ chọn <strong>Dịch vụ giọng nói của Google</strong> ➔ biểu tượng bánh răng ➔ <em>Cài đặt dữ liệu thoại</em> ➔ tải <strong>Tiếng Việt (Việt Nam)</strong>.</li>
                      <li><strong>iPhone / iPad:</strong> Vào <em>Cài đặt ➔ Trợ năng ➔ Nội dung được đọc ➔ Giọng nói</em> ➔ chọn <strong>Tiếng Việt</strong> ➔ tải giọng <strong>Linh (Nâng cao)</strong> miễn phí.</li>
                    </ul>
                  </div>
                )}

                {guideTab === 'browser' && (
                  <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                    <p className="font-bold text-slate-900">Mẹo sử dụng trình duyệt có sẵn giọng Tiếng Việt tự nhiên nhất:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Microsoft Edge (Khuyên dùng trên mọi PC Windows/Mac):</strong> Tích hợp sẵn miễn phí giọng đọc neural tự nhiên <em>Microsoft HoaiMy Online (Natural)</em> &amp; <em>NamMinh</em> mà không cần cài thêm gói ngôn ngữ.</li>
                      <li><strong>Google Chrome / Cốc Cốc:</strong> Cung cấp sẵn giọng <em>Google Tiếng Việt</em> khi có mạng và sử dụng giọng hệ thống Windows/macOS khi ngoại tuyến.</li>
                      <li><strong>Mọi trình duyệt khác (Firefox, Safari, Brave):</strong> Tự động phát MP3 Tiếng Việt trực tiếp từ máy chủ (Miễn phí 100%, không cần cài đặt thêm).</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reminder Interval & Max Reminders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Tự động nhắc lại nếu chưa chốt lịch</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Nếu quản lý chưa bấm xem chi tiết hoặc chưa chốt lịch, hệ thống sẽ phát lại nhắc nhở sau mỗi:
              </p>
              <select
                value={reminderIntervalSeconds}
                onChange={(e) => setReminderIntervalSeconds(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value={30}>30 giây (Rất nhanh - Dành cho giờ cao điểm)</option>
                <option value={60}>60 giây (1 phút - Khuyến nghị tiêu chuẩn)</option>
                <option value={90}>90 giây (1 phút 30 giây)</option>
                <option value={120}>2 phút (Vừa phải)</option>
                <option value={180}>3 phút</option>
                <option value={300}>5 phút</option>
                <option value={0}>Tắt tự động nhắc lại</option>
              </select>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-indigo-600" />
                <span>Số lần nhắc nhở tối đa</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Số chu kỳ phát thanh nhắc nhở trước khi tạm ngưng nếu không có thao tác:
              </p>
              <select
                value={maxReminders}
                onChange={(e) => setMaxReminders(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value={1}>1 lần nhắc</option>
                <option value={3}>3 lần nhắc</option>
                <option value={5}>5 lần nhắc (Khuyến nghị)</option>
                <option value={10}>10 lần nhắc</option>
              </select>
            </div>
          </div>

          {/* Volume and Test Broadcast */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5 block">
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
                  useBroadcastStore.getState().setVolume(val);
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <button
                id="btn-test-broadcast"
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang phát nhạc hiệu &amp; giọng đọc...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    <span>Nghe thử Nhạc hiệu &amp; Giọng đọc</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p>
              <strong>Cơ chế xếp hàng &amp; tự ngắt thông minh:</strong> Khi có nhiều khách đặt lịch liên tiếp, các thông báo sẽ xếp hàng phát tuần tự từng bản tin (Nhạc hiệu ➔ Giọng đọc Tiếng Việt), không bao giờ phát chồng lấn lên nhau. Khi quản lý bấm <em>&ldquo;Chốt lịch ngay&rdquo;</em> hoặc mở xem chi tiết, vòng lặp nhắc nhở sẽ tự động dừng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
