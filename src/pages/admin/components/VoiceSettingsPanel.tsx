import React, { useEffect, useState } from 'react';
import { Volume2, Server, Globe, VolumeX, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';
import { useVoiceStore } from '../../../store/voiceStore';
import { ServerSpeechEngine } from '../../../services/speech/ServerSpeechEngine';

export default function VoiceSettingsPanel() {
  const { enabled, setEnabled, volume, setVolume, rate, setRate } = useVoiceStore();
  const [ttsStatus, setTtsStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/tts/status', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') as string)?.state?.token : ''}`
      }
    })
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
    ServerSpeechEngine.unlockAudio(); // Important: must be called synchronously in onClick
    try {
      await ServerSpeechEngine.speak("Đây là âm thanh thử nghiệm. Hệ thống đọc thông báo tiếng Việt đang hoạt động bình thường.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Giọng đọc thông báo (Voice Notification)</h2>
          <p className="text-sm text-slate-500">Quản lý cách hệ thống phát âm thanh khi có lịch hẹn mới</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Trợ lý âm thanh Dental Smart</h3>
            <p className="text-sm text-slate-500">Tự động đọc thông tin khách hàng, bác sĩ và giờ hẹn</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                if (e.target.checked) {
                  ServerSpeechEngine.unlockAudio();
                }
              }} 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className={`transition-all duration-300 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          {/* Server Status */}
          <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-white">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-400" />
              Tình trạng máy chủ TTS
            </h4>
            
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra...
              </div>
            ) : ttsStatus?.enabled ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đã kết nối máy chủ
                </div>
                <div className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono">
                  {ttsStatus.providers.join(', ')}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Máy chủ chưa bật giọng đọc tiếng Việt cao cấp</p>
                  <p className="text-amber-700">Hệ thống sẽ dự phòng bằng gói ngôn ngữ cài trên trình duyệt của máy tính này. Nếu máy tính chưa cài tiếng Việt, bạn có thể nghe thấy giọng tiếng Anh.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Âm lượng: {Math.round(volume * 100)}%
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleTest}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
              >
                {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                Nghe thử thông báo
              </button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <a href="/kiem-tra-giong-doc.html" target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 w-max">
              <Globe className="w-4 h-4" /> Công cụ chẩn đoán giọng đọc của máy tính (Dự phòng)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
