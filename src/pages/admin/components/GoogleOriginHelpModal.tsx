import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle, 
  ShieldCheck, 
  Key, 
  HelpCircle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useGoogleAuthStore } from '../../../store/googleAuthStore';
import api from '../../../services/api';

interface GoogleOriginHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleOriginHelpModal: React.FC<GoogleOriginHelpModalProps> = ({
  isOpen,
  onClose
}) => {
  const { customClientId, activeClientId, setCustomClientId } = useGoogleAuthStore();
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [inputClientId, setInputClientId] = useState(customClientId || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [serverSyncNote, setServerSyncNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://booking-phongkham.onrender.com';

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2500);
  };

  const handleCopyClientId = () => {
    if (!activeClientId) return;
    navigator.clipboard.writeText(activeClientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2500);
  };

  const handleSaveClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputClientId.trim();
    setCustomClientId(trimmed);
    setSavedSuccess(true);
    setSavingServer(true);
    setServerSyncNote(null);
    try {
      await api.put('/admin/google-oauth-config', { clientId: trimmed });
      setServerSyncNote('Đã đồng bộ lên máy chủ (tự động áp dụng trên mọi trình duyệt & điện thoại).');
    } catch {
      setServerSyncNote('Đã lưu trên trình duyệt này.');
    } finally {
      setSavingServer(false);
      setTimeout(() => setSavedSuccess(false), 3500);
    }
  };

  const handleResetClientId = async () => {
    setInputClientId('');
    setCustomClientId('');
    setSavedSuccess(true);
    setSavingServer(true);
    setServerSyncNote(null);
    try {
      await api.put('/admin/google-oauth-config', { clientId: '' });
      setServerSyncNote('Đã khôi phục mặc định trên máy chủ.');
    } catch {
      setServerSyncNote('Đã khôi phục mặc định trên trình duyệt này.');
    } finally {
      setSavingServer(false);
      setTimeout(() => setSavedSuccess(false), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Khắc phục "Lỗi 400: origin_mismatch" từ Google
              </h3>
              <p className="text-xs text-slate-600">
                Hướng dẫn cấu hình tên miền cho phép truy cập OAuth 2.0
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto text-sm text-slate-700">
          {/* Cause explanation */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
              <Info className="w-4 h-4 shrink-0" />
              <span>Tại sao Google xuất hiện lỗi này?</span>
            </div>
            <p className="leading-relaxed">
              Google quy định vì lý do an ninh, bất kỳ tên miền nào (như <span className="font-semibold text-slate-900 font-mono bg-amber-100/80 px-1 py-0.5 rounded">{currentOrigin}</span>) muốn đăng nhập Google thì địa chỉ đó <strong>bắt buộc phải được khai báo</strong> trong danh sách <em>"Mã nguồn JavaScript đã cho phép" (Authorized JavaScript origins)</em> trên Google Cloud Console.
            </p>
          </div>

          {/* Quick Origin copy box */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Địa chỉ web (Origin) cần khai báo vào Google:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 select-all font-semibold">
                {currentOrigin}
              </div>
              <Button
                type="button"
                onClick={handleCopyOrigin}
                variant="outline"
                className="gap-1.5 text-xs font-semibold border-slate-300 bg-white hover:bg-slate-50 shrink-0 px-4 py-2.5 rounded-xl h-auto"
              >
                {copiedOrigin ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Sao chép URI</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Lưu ý: Không có dấu gạch chéo (/) ở cuối địa chỉ.
            </p>
          </div>

          {/* Active Client ID diagnostic box */}
          {activeClientId && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Client ID đang hoạt động hiện tại:
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-[11px] bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2 text-indigo-950 select-all break-all">
                  {activeClientId}
                </div>
                <Button
                  type="button"
                  onClick={handleCopyClientId}
                  variant="outline"
                  className="gap-1.5 text-xs font-semibold border-slate-300 bg-white hover:bg-slate-50 shrink-0 px-3 py-2 rounded-xl h-auto"
                >
                  {copiedClientId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Sao chép</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Solution 1: Add origin to Google Cloud Console */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">1</span>
              <span>Cách 1: Thêm tên miền vào Google Cloud Console (Khuyên dùng)</span>
            </div>
            
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 ml-1">
              <li className="leading-relaxed">
                Truy cập trang quản trị Google Credentials:{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:text-teal-900 font-semibold underline inline-flex items-center gap-1"
                >
                  console.cloud.google.com/apis/credentials
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li className="leading-relaxed">
                Tại mục <strong>OAuth 2.0 Client IDs</strong>, nhấp chọn tên Client ID bạn đang sử dụng.
              </li>
              <li className="leading-relaxed">
                Cuộn xuống mục <strong>Mã nguồn JavaScript đã cho phép (Authorized JavaScript origins)</strong>, bấm nút <strong>Thêm URI (Add URI)</strong>.
              </li>
              <li className="leading-relaxed">
                Dán địa chỉ: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-800 font-mono">{currentOrigin}</code>
                <p className="mt-1 text-slate-500">
                  <em>(Khuyên dùng: Bấm Add URI thêm cả địa chỉ phụ nếu có dùng www: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">https://www.booking-phongkham.onrender.com</code>)</em>
                </p>
              </li>
              <li className="leading-relaxed">
                Nhấn nút <strong>Lưu (Save)</strong> ở cuối trang.
              </li>
              <li className="leading-relaxed text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
                <strong>⏳ Lưu ý quan trọng về thời gian hiệu lực:</strong> Google Cloud ghi rõ <em>"It may take 5 minutes to a few hours for settings to take effect"</em>. Hệ thống máy chủ Google cần từ <strong>5 đến 15 phút</strong> để phân phối URI mới tới tất cả các cụm máy chủ toàn cầu.
                <div className="mt-1.5 text-[11px] text-slate-700">
                  👉 Sau khi Save, vui lòng <strong>đợi khoảng 5–10 phút</strong>, sau đó nhấn <strong>Ctrl + Shift + R</strong> hoặc mở <strong>Cửa sổ ẩn danh (Ctrl + Shift + N)</strong> để thử lại nhằm tránh trình duyệt lưu đệm kết quả lỗi cũ.
                </div>
              </li>
            </ol>
          </div>

          {/* Solution 2: Custom Client ID for this Clinic */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                <span>Cách 2: Cài đặt Google Client ID riêng cho phòng khám</span>
              </div>
              {customClientId && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                  Đang dùng Client ID tùy chỉnh
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Nếu phòng khám tự tạo OAuth Client ID trên tài khoản Google Cloud riêng của bạn (loại Web Application), bạn có thể dán trực tiếp Client ID vào đây để hệ thống kết nối ngay mà không cần build lại mã nguồn trên Render:
            </p>

            <form onSubmit={handleSaveClientId} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Google OAuth Client ID của phòng khám:</span>
                  <span className="text-[11px] text-slate-400 font-normal">Dạng: xxx.apps.googleusercontent.com</span>
                </label>
                <Input
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  placeholder="Ví dụ: 123456789-abcdef.apps.googleusercontent.com"
                  className="font-mono text-xs py-2"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={savingServer}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl h-auto shadow-xs disabled:opacity-60"
                  >
                    <Key className="w-3.5 h-3.5 mr-1" />
                    {savingServer ? 'Đang lưu...' : 'Lưu Client ID này'}
                  </Button>

                  {customClientId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingServer}
                      onClick={handleResetClientId}
                      className="text-xs text-slate-600 hover:text-rose-600 border-slate-300 px-3 py-2 rounded-xl h-auto"
                      title="Khôi phục về Client ID mặc định của hệ thống"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Khôi phục mặc định
                    </Button>
                  )}
                </div>

                {savedSuccess && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Đã cập nhật thành công!
                  </span>
                )}
              </div>
              {serverSyncNote && (
                <p className="text-[11px] text-emerald-700 font-medium">{serverSyncNote}</p>
              )}
            </form>

            <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <strong>Mẹo triển khai Render:</strong> Bạn cũng có thể thiết lập biến môi trường <code className="text-indigo-700 font-mono font-semibold">VITE_GOOGLE_CLIENT_ID</code> trong mục <em>Environment Variables</em> trên Render để hệ thống tự động nhận diện vĩnh viễn trên mọi trình duyệt.
            </div>
          </div>

          {/* Solution 3: OAuth Consent Screen Testing / Test Users */}
          <div className="border border-rose-200/90 rounded-2xl p-4 bg-rose-50/40 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">3</span>
              <span>Khắc phục lỗi "chưa hoàn tất quy trình xác minh của Google" (Test Users)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nếu Google hiển thị thông báo ứng dụng đang ở <strong>giai đoạn kiểm thử</strong> và chỉ người kiểm thử được phê duyệt mới truy cập được:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 ml-1">
              <li className="leading-relaxed">
                Mở{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-700 hover:text-rose-900 font-semibold underline inline-flex items-center gap-1"
                >
                  Google Cloud → OAuth consent screen
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
                .
              </li>
              <li className="leading-relaxed">
                Ở mục <strong>Test users (Người dùng thử nghiệm)</strong>, bấm <strong>+ Add users</strong> và thêm địa chỉ Gmail bạn muốn dùng để sao lưu phòng khám, sau đó bấm <strong>Save</strong>.
              </li>
              <li className="leading-relaxed">
                Hoặc bấm <strong>Publish App</strong> (chuyển từ <em>Testing</em> sang <em>In production</em>) nếu muốn cho phép bất kỳ tài khoản Gmail phòng khám nào tự kết nối mà không cần thêm từng email trước.
              </li>
              <li className="leading-relaxed">
                Khi đã bật <strong>In production</strong> (chưa xác minh Google Verification), lần đầu kết nối Drive/Sheets trên một tài khoản Gmail mới sẽ hiện bảng cảnh báo <em>"Google chưa xác minh ứng dụng này"</em> — chỉ cần bấm <strong>Nâng cao (Advanced) → Đi tới trang web (không an toàn) → Cho phép</strong> để hoàn tất.
              </li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            Mã nguồn hỗ trợ đồng bộ trực tiếp Google Drive & Sheets
          </span>
          <Button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-5 py-2 rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
export default GoogleOriginHelpModal;
