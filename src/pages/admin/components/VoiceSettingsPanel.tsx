import React, { useEffect, useState } from 'react';
import { 
  Volume2, 
  Server, 
  Globe, 
  VolumeX, 
  AlertCircle, 
  PlayCircle, 
  Loader2, 
  Clock, 
  BellRing, 
  RotateCw, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useVoiceStore } from '../../../store/voiceStore';
import { useBroadcastStore } from '../../../store/broadcastStore';
import { ServerSpeechEngine } from '../../../services/speech/ServerSpeechEngine';

export default function VoiceSettingsPanel() {
  const { enabled, setEnabled, volume, setVolume } = useVoiceStore();
  const { 
    reminderIntervalSeconds, 
    setReminderIntervalSeconds, 
    maxReminders, 
    setMaxReminders,
    autoChime,
    setAutoChime,
    testBroadcast
  } = useBroadcastStore();

  const [ttsStatus, setTtsStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/tts/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTtsStatus(data.data);
        }
      })
      .catch(err => console.error("Could not fetch TTS status", err))
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await testBroadcast();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div id="voice-settings-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Phát thanh thông báo & Nhắc nhở lịch hẹn</h2>
          <p className="text-sm text-slate-500">Nhạc hiệu chuyên nghiệp, giọng đọc tiếng Việt chuẩn và vòng lặp tự động nhắc nhở khi chưa chốt lịch</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <span>Trợ lý phát thanh phòng khám</span>
              <span className="text-xs font-normal text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Độc lập thiết bị
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Tự động phát nhạc hiệu & đọc thông tin khách hàng khi có lịch hẹn mới</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
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

        <div className={`transition-all duration-300 space-y-6 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          {/* Server TTS Status */}
          <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-emerald-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Máy chủ giọng đọc tiếng Việt chất lượng cao</span>
              </div>
              <div className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                {ttsStatus?.providers?.join(', ') || 'Google Voice Tiếng Việt Chuẩn (Tất cả thiết bị)'}
              </div>
            </div>
            <p className="text-xs text-emerald-700 mt-1.5">
              Hệ thống kết xuất âm thanh trực tiếp từ máy chủ định dạng MP3, phát chuẩn tiếng Việt trên mọi dòng điện thoại iOS, Android và máy tính mà không cần cài thêm gói giọng đọc.
            </p>
          </div>

          {/* Reminder Interval & Max Reminders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Auto Reminder Interval */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Tự động nhắc lại nếu chưa chốt lịch</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Nếu quản lý chưa bấm xem chi tiết hoặc chưa chốt lịch, hệ thống sẽ phát lại nhắc nhở sau mỗi:
              </p>
              <select
                value={reminderIntervalSeconds || ''}
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

            {/* Max Reminders */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-indigo-600" />
                <span>Số lần nhắc nhở tối đa</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Số chu kỳ phát thanh nhắc nhở trước khi tạm ngưng nếu không có thao tác:
              </p>
              <select
                value={maxReminders || ''}
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
                value={volume || ''}
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
                onClick={handleTest}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang phát nhạc hiệu & giọng đọc...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    <span>Nghe thử Nhạc hiệu & Giọng đọc</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Note */}
          <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p>
              <strong>Cơ chế tự ngắt thông minh:</strong> Khi người quản lý bấm <em>"Chốt lịch ngay"</em>, mở xem chi tiết lịch hẹn, hoặc cập nhật trạng thái lịch, hệ thống sẽ tự động dừng vòng lặp nhắc nhở ngay lập tức.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
