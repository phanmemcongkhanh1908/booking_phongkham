import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  RefreshCw, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Mail,
  UserPlus
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface UnauthorizedModalData {
  isOpen: boolean;
  email?: string;
  reason?: 'access_denied' | 'not_in_whitelist' | string;
  details?: string;
  timestamp?: string;
}

interface UnauthorizedEmailModalProps {
  data: UnauthorizedModalData;
  onClose: () => void;
  onRetryWithDifferentAccount?: () => void;
}

export const UnauthorizedEmailModal: React.FC<UnauthorizedEmailModalProps> = ({
  data,
  onClose,
  onRetryWithDifferentAccount,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!data.isOpen) return null;

  const emailToDisplay = data.email || '';
  const timestamp = data.timestamp || new Date().toLocaleString('vi-VN');

  const handleCopy = () => {
    if (!emailToDisplay) return;
    navigator.clipboard.writeText(emailToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 sm:p-7 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-7 h-7 text-amber-600" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-100/80 text-amber-800 border border-amber-200/60">
                Bảo mật hệ thống • Admin Whitelist
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Email chưa được uỷ quyền
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Tài khoản Google này chưa có trong danh sách được phép truy cập.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-6 sm:px-7 space-y-4 text-sm text-slate-600">
          {/* Email Highlight Box */}
          {emailToDisplay ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono text-slate-800 font-semibold text-xs sm:text-sm truncate">
                  {emailToDisplay}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Google OAuth từ chối quyền truy cập (mã lỗi: <strong>access_denied</strong>). Tài khoản bạn chọn chưa được kích hoạt quyền sử dụng.
              </span>
            </div>
          )}

          {/* Explanation Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-primary" />
              Tại sao bạn thấy thông báo này?
            </h4>
            <p className="text-xs leading-relaxed text-slate-600">
              Để bảo vệ tuyệt đối thông tin bệnh án và lịch hẹn của phòng khám, Dental Smart Booking chỉ cho phép những tài khoản Google đã được <strong>Admin Tổng phê duyệt trước</strong> trong danh sách <strong>Admin Whitelist</strong>.
            </p>
          </div>

          {/* Action Guide */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-teal-600" />
              Cách kích hoạt tài khoản để đăng nhập:
            </h4>
            <ol className="space-y-2 text-xs text-slate-600 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 text-[11px] border border-teal-200">
                  1
                </span>
                <span>
                  <strong>Gửi email cho Quản trị viên:</strong> Nhấn nút <em>Sao chép</em> địa chỉ email ở trên và gửi cho Admin Tổng của phòng khám bạn.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 text-[11px] border border-teal-200">
                  2
                </span>
                <span>
                  <strong>Admin thêm vào Whitelist:</strong> Quản trị viên chỉ cần vào mục <strong>Tài khoản &gt; Gmail phòng khám (Google Sync Accounts)</strong> để thêm email này vào danh sách được cấp phép.
                </span>
              </li>
            </ol>
          </div>

          {/* Collapsible Technical Error Details */}
          <div className="border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors cursor-pointer"
            >
              <span>Chi tiết kỹ thuật &amp; Mã log lỗi (Diagnostics)</span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="mt-2 p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono space-y-1.5 overflow-x-auto shadow-inner">
                <div><span className="text-slate-500">status:</span> 403 Forbidden / Access Denied</div>
                <div><span className="text-slate-500">error_code:</span> {data.reason || 'access_denied'}</div>
                <div><span className="text-slate-500">attempted_email:</span> {emailToDisplay || 'unspecified'}</div>
                <div><span className="text-slate-500">timestamp:</span> {timestamp}</div>
                {data.details && (
                  <div><span className="text-slate-500">details:</span> {data.details}</div>
                )}
                <div className="text-amber-400/90 pt-1 border-t border-slate-800">
                  Notice: Ensure this email is registered under Admin Whitelist (settings.google_sync_accounts) or Google Cloud Console OAuth Test Users.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 sm:p-7 pt-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {onRetryWithDifferentAccount && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onRetryWithDifferentAccount();
              }}
              className="w-full sm:w-auto text-xs py-2 px-3.5 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Chọn tài khoản Google khác</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto text-xs py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
          >
            Đã hiểu, quay lại
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedEmailModal;
