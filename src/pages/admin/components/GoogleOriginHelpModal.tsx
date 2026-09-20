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

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://booking-phongkham.onrender.com';

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2500);
  };

  const handleCopyClientId = () => {
    navigator.clipboard.writeText(activeClientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2500);
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomClientId(inputClientId);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetClientId = () => {
    setInputClientId('');
    setCustomClientId('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
                Dán địa chỉ: <code className="bg-slate-200 px-1 py-0.5 rounded font-bold text-slate-800">{currentOrigin}</code>
              </li>
              <li className="leading-relaxed">
                Nhấn nút <strong>Lưu (Save)</strong> ở cuối trang. Sau đó đợi 1-2 phút để Google cập nhật rồi thử đăng nhập lại.
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl h-auto shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5 mr-1" />
                    Lưu Client ID này
                  </Button>

                  {customClientId && (
                    <Button
                      type="button"
                      variant="outline"
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
            </form>

            <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <strong>Mẹo triển khai Render:</strong> Bạn cũng có thể thiết lập biến môi trường <code className="text-indigo-700 font-mono font-semibold">VITE_GOOGLE_CLIENT_ID</code> trong mục <em>Environment Variables</em> trên Render để hệ thống tự động nhận diện vĩnh viễn.
            </div>
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
