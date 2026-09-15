import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Cloud, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  X, 
  FileSpreadsheet, 
  HardDrive,
  Database,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { useAuthStore } from '../../store/auth';
import { findOrCreateClinicSpreadsheet, syncAppointmentsToSheet } from '../../lib/googleWorkspace';
import api from '../../services/api';

interface GoogleBackupWarningBannerProps {
  onNavigateToSettings?: () => void;
  appointments?: any[];
  onAppointmentsSynced?: () => void;
}

export const GoogleBackupWarningBanner: React.FC<GoogleBackupWarningBannerProps> = ({
  onNavigateToSettings,
  appointments,
  onAppointmentsSynced
}) => {
  const { 
    isConnected, 
    user, 
    isConnecting, 
    connect, 
    warningDismissed, 
    setWarningDismissed,
    spreadsheetId,
    spreadsheetUrl,
    setSpreadsheetInfo,
    lastSyncAt,
    setLastSyncAt
  } = useGoogleAuthStore();

  const currentUser = useAuthStore(s => s.user);
  const isClinicAdmin = currentUser?.tenantId != null;

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleQuickConnect = async () => {
    try {
      setSyncMsg(null);
      const { accessToken } = await connect();
      // Auto-find or create the clinic's spreadsheet
      try {
        const sheetInfo = await findOrCreateClinicSpreadsheet(accessToken, 'Dental Smart');
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
        
        // If appointments are available, auto sync
        if (appointments && appointments.length > 0) {
          const res = await syncAppointmentsToSheet(appointments, accessToken, sheetInfo.spreadsheetId);
          setLastSyncAt(new Date().toLocaleTimeString('vi-VN'));
          setSyncMsg({ 
            type: 'success', 
            text: `Đã kết nối Google và đồng bộ ${res.count} lịch hẹn vào Google Sheets!` 
          });
        } else {
          setSyncMsg({ 
            type: 'success', 
            text: 'Đã kết nối tài khoản Google thành công! Bảng tính sao lưu đã sẵn sàng.' 
          });
        }
      } catch (e: any) {
        console.warn('Auto spreadsheet init warning:', e);
      }
    } catch (err: any) {
      if (err?.isCancelled || err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      setSyncMsg({ 
        type: 'error', 
        text: err.message || 'Không thể kết nối tài khoản Google. Vui lòng thử lại.' 
      });
    }
  };

  const handleManualSyncAll = async () => {
    const { accessToken, spreadsheetId } = useGoogleAuthStore.getState();
    if (!accessToken) {
      handleQuickConnect();
      return;
    }

    try {
      setSyncing(true);
      setSyncMsg(null);

      let targetSheetId = spreadsheetId;
      if (!targetSheetId) {
        const sheetInfo = await findOrCreateClinicSpreadsheet(accessToken, 'Dental Smart');
        targetSheetId = sheetInfo.spreadsheetId;
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
      }

      // Fetch fresh appointments if not passed
      let list = appointments;
      if (!list || list.length === 0) {
        const res = await api.get('/appointments');
        list = res.data?.data || [];
      }

      const syncResult = await syncAppointmentsToSheet(list || [], accessToken, targetSheetId);
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSyncAt(timeStr);
      setSyncMsg({
        type: 'success',
        text: `Đã đồng bộ an toàn ${syncResult.count} lịch hẹn vào Google Sheets lúc ${timeStr}!`
      });
      if (onAppointmentsSynced) onAppointmentsSynced();
    } catch (e: any) {
      console.error('Sync error:', e);
      setSyncMsg({
        type: 'error',
        text: 'Lỗi đồng bộ: ' + (e.message || 'Vui lòng kiểm tra quyền truy cập Google Sheets')
      });
    } finally {
      setSyncing(false);
    }
  };

  // 1. If Connected: Show clean reassurance status bar
  if (isConnected) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 p-4 shadow-xs text-slate-800 transition-all print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                  Dữ liệu đã được bảo vệ kép
                </span>
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-blue-600" /> Neon Cloud +
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" /> Google Drive & Sheets
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Tài khoản đồng bộ: <strong className="text-slate-800 font-semibold">{user?.email || 'Google Account'}</strong>
                {lastSyncAt && (
                  <span className="ml-2 text-emerald-700 font-medium">
                    • Đã đồng bộ gần nhất lúc {lastSyncAt}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Mở Google Sheets của phòng khám"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mở Google Sheets</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            <button
              type="button"
              onClick={handleManualSyncAll}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className={`mt-2.5 pt-2 border-t border-emerald-200/60 text-xs font-medium flex items-center gap-2 ${
            syncMsg.type === 'success' ? 'text-emerald-800' : 'text-rose-700'
          }`}>
            <span>{syncMsg.text}</span>
          </div>
        )}
      </div>
    );
  }

  // 2. If warning was temporarily dismissed for this session
  if (warningDismissed) {
    return (
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-2.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 shadow-2xs print:hidden">
        <div className="flex items-start sm:items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-snug">
            <strong>Nhắc nhở:</strong> Chưa kết nối Google Drive & Sheets để sao lưu dự phòng ngoại vi.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto pt-1 sm:pt-0">
          <button
            type="button"
            onClick={handleQuickConnect}
            disabled={isConnecting}
            className="font-bold text-amber-800 hover:underline flex items-center gap-1 whitespace-nowrap bg-amber-100/80 sm:bg-transparent px-2.5 py-1 sm:p-0 rounded-lg sm:rounded-none"
          >
            <span>{isConnecting ? 'Đang kết nối...' : 'Kết nối ngay'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setWarningDismissed(false)}
            className="text-slate-500 hover:text-slate-700 whitespace-nowrap text-xs underline"
            title="Mở rộng thông báo"
          >
            Chi tiết
          </button>
        </div>
      </div>
    );
  }

  // 3. Main Warning Banner: Admin has not connected Google yet
  return (
    <div className={`mb-6 rounded-2xl border p-4 sm:p-5 shadow-xs relative transition-all print:hidden overflow-hidden ${
      isClinicAdmin 
        ? 'border-rose-200 bg-gradient-to-r from-rose-50/90 via-white to-rose-50/50 text-slate-900' 
        : 'border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-teal-50/30 text-slate-800'
    }`}>
      {/* Dismiss button */}
      {!isClinicAdmin && (
        <button
          type="button"
          onClick={() => setWarningDismissed(true)}
          className="absolute top-3 right-3 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Tạm ẩn cảnh báo trong phiên này"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${
            isClinicAdmin ? 'bg-rose-600 shadow-rose-600/20' : 'bg-amber-600 shadow-amber-600/20'
          }`}>
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="space-y-1.5 pr-6 sm:pr-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                isClinicAdmin 
                  ? 'bg-rose-100 text-rose-800 border-rose-200' 
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                <Sparkles className={`w-3 h-3 ${isClinicAdmin ? 'text-rose-700' : 'text-amber-700'}`} />
                {isClinicAdmin ? 'Yêu Cầu Bắt Buộc' : 'Bảo vệ an toàn dữ liệu'}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {isClinicAdmin ? 'Cách ly dữ liệu phòng khám' : 'Khuyến nghị thiết lập sao lưu ngoại vi'}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Phòng khám chưa kích hoạt sao lưu dự phòng Google Drive & Google Sheets
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              {isClinicAdmin ? (
                <span>
                  Để bảo mật thông tin và phục hồi dữ liệu phòng khám khi cần, vui lòng kết nối tài khoản Google để thiết lập kênh sao lưu tự động.
                </span>
              ) : (
                <span>
                  Dữ liệu đang được lưu trữ an toàn trên đám mây <strong className="text-slate-800 font-semibold">Neon</strong>. Kết nối thêm tài khoản Google giúp phòng khám:
                </span>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-white/90 text-slate-700 border border-slate-200/80 shadow-2xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tự động xuất & đồng bộ sang <strong>Google Sheets</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-white/90 text-slate-700 border border-slate-200/80 shadow-2xs">
                <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Lưu trữ phim chụp & bệnh án vào <strong>Google Drive</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 w-full lg:w-auto pt-1 lg:pt-0">
          <button
            type="button"
            onClick={handleQuickConnect}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs sm:text-sm font-bold shadow-sm shadow-teal-600/20 hover:bg-teal-700 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <Cloud className="w-4 h-4" />
            <span>{isConnecting ? 'Đang mở kết nối...' : 'Kết nối Google ngay'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Xem cấu hình chi tiết</span>
              </button>
            )}

            {!isClinicAdmin && (
              <button
                type="button"
                onClick={() => setWarningDismissed(true)}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 transition-colors cursor-pointer"
              >
                Để sau
              </button>
            )}
          </div>
        </div>
      </div>

      {syncMsg && (
        <div className={`mt-3 pt-2.5 border-t border-slate-200/80 text-xs font-medium flex items-center gap-2 ${
          syncMsg.type === 'success' ? 'text-emerald-800' : 'text-rose-700'
        }`}>
          <span>{syncMsg.text}</span>
        </div>
      )}
    </div>
  );
};
export default GoogleBackupWarningBanner;
