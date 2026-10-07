import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Layers, 
  FileSpreadsheet, 
  Users, 
  Calendar 
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface DataCleanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultMode?: 'clean_demo' | 'full_reset';
}

export const DataCleanModal: React.FC<DataCleanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultMode = 'clean_demo',
}) => {
  const [mode, setMode] = useState<'clean_demo' | 'full_reset'>(defaultMode);
  const [confirmInput, setConfirmInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);

  if (!isOpen) return null;

  const expectedCode = mode === 'clean_demo' ? 'XOA DEMO' : 'RESET';
  const isCodeMatch = confirmInput.trim().toUpperCase() === expectedCode;

  const handleExecute = async () => {
    if (!isCodeMatch && confirmInput.trim().toUpperCase() !== 'WIPE') {
      return;
    }

    setIsLoading(true);
    setResultSummary(null);

    try {
      const res = await api.post('/admin/wipe', {
        mode,
        confirmText: confirmInput.trim()
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Thao tác dọn dẹp dữ liệu hoàn tất an toàn!');
        setResultSummary(res.data);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(res.data?.error?.message || 'Có lỗi xảy ra khi dọn dẹp dữ liệu');
      }
    } catch (err: any) {
      console.error('Data clean error:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Lỗi khi xử lý dữ liệu';
      toast.error('Lỗi: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setConfirmInput('');
    setResultSummary(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
              mode === 'clean_demo' ? 'bg-amber-500' : 'bg-red-600'
            }`}>
              {mode === 'clean_demo' ? <Sparkles className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {mode === 'clean_demo' ? 'Xóa sạch dữ liệu demo / thử nghiệm' : 'Reset dữ liệu hệ thống'}
              </h3>
              <p className="text-xs text-slate-500">
                Dọn dẹp an toàn theo chuẩn quan hệ khóa ngoại (Foreign Key Safe)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-600">
          {resultSummary ? (
            /* Results View */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-emerald-900 space-y-1">
                  <p className="font-bold">{resultSummary.message}</p>
                  <p className="text-emerald-700">
                    Mọi quan hệ dữ liệu liên quan (lịch hẹn, bệnh nhân, lịch nhắc, nhật ký) đã được giải phóng an toàn mà không để lại bản ghi rác hay lỗi khóa ngoại.
                  </p>
                </div>
              </div>

              {resultSummary.wipedSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Thống kê số lượng bản ghi đã dọn dẹp:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Lịch hẹn:</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.appointments ?? 0}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Bệnh nhân:</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.patients ?? 0}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Giữ chỗ (Holds):</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.appointment_holds ?? 0}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Lịch nhắc tái khám:</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.patient_recalls ?? 0}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Hàng đợi chờ:</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.waitlist ?? 0}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-slate-500 block">Nhật ký hệ thống:</span>
                      <strong className="text-base text-slate-900 font-bold">
                        {resultSummary.wipedSummary.audit_logs ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-800 transition-colors"
                >
                  Đóng & Cập nhật màn hình
                </button>
              </div>
            </div>
          ) : (
            /* Configure & Confirm View */
            <>
              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setMode('clean_demo'); setConfirmInput(''); }}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'clean_demo'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Xóa dữ liệu demo (Khuyên dùng)
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('full_reset'); setConfirmInput(''); }}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'full_reset'
                      ? 'bg-white text-red-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-red-600" />
                  Reset hệ thống toàn diện
                </button>
              </div>

              {/* Scope Description */}
              {mode === 'clean_demo' ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      Mục đích: Chuẩn bị hệ thống sẵn sàng đón khách hàng thật
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Tính năng này sẽ xóa sạch các lịch hẹn thử nghiệm, bệnh nhân demo, lịch tái khám mẫu và giải phóng các khung giờ đặt lịch. 
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-red-700 font-bold">
                        <Trash2 className="w-3.5 h-3.5" />
                        Dữ liệu sẽ được dọn sạch:
                      </div>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                        <li>Toàn bộ lịch hẹn (Appointments)</li>
                        <li>Danh sách bệnh nhân / khách demo</li>
                        <li>Lịch giữ chỗ tạm thời (Holds)</li>
                        <li>Hàng đợi & nhắc tái khám</li>
                        <li>Nhật ký thao tác thử nghiệm</li>
                      </ul>
                    </div>

                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        BẢO TỒN NGUYÊN VẸN 100%:
                      </div>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                        <li>Danh mục dịch vụ nha khoa & giá</li>
                        <li>Danh sách bác sĩ & giờ khám</li>
                        <li>Cấu hình phòng khám, Logo, Banner</li>
                        <li>Tài khoản đăng nhập của bạn</li>
                        <li>Liên kết đặt lịch (slug) không bị đổi</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 bg-red-50/80 border border-red-200/80 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-900 font-bold text-xs sm:text-sm">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      Cảnh báo: Đưa toàn bộ phòng khám về trạng thái ban đầu
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed">
                      Hệ thống sẽ dọn dẹp sạch toàn bộ lịch hẹn, khách hàng, cấu hình dịch vụ cũ theo đúng thứ tự khóa ngoại, sau đó tự động tái tạo bộ 5 dịch vụ nha khoa chuẩn và 1 bác sĩ chuyên khoa mặc định.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                    <p className="font-semibold text-slate-800">Tài khoản quản trị luôn được bảo vệ:</p>
                    <p className="text-[11px] text-slate-500">
                      Tài khoản Admin và các thông tin liên kết phòng khám sẽ không bao giờ bị mất hoặc bị khóa.
                    </p>
                  </div>
                </div>
              )}

              {/* Confirmation Input */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Để xác nhận, vui lòng nhập chính xác chữ{' '}
                  <span className={`font-mono font-extrabold ${mode === 'clean_demo' ? 'text-amber-600' : 'text-red-600'}`}>
                    {expectedCode}
                  </span>{' '}
                  vào ô dưới đây:
                </label>
                <input
                  type="text"
                  placeholder={`Nhập ${expectedCode} để tiếp tục`}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-3.5 py-2 text-sm rounded-xl border font-mono transition-colors focus:outline-hidden ${
                    isCodeMatch
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                      : 'border-slate-300 focus:border-slate-500'
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={!isCodeMatch || isLoading}
                  className={`px-4 py-2 text-xs sm:text-sm font-bold text-white rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto ${
                    mode === 'clean_demo'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang dọn dẹp an toàn...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      {mode === 'clean_demo' ? 'Xác nhận Xóa Dữ Liệu Demo' : 'Xác nhận Reset Hệ Thống'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
