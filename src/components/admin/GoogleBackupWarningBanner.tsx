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
      <div className="mb-6 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 p-4 shadow-xs text-slate-800 transition-all">
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
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-2.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 shadow-2xs">
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
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-4 sm:p-5 shadow-sm text-slate-800 relative transition-all">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => setWarningDismissed(true)}
        className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="Tạm ẩn cảnh báo trong phiên này"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-amber-100 mt-0.5">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-200/80 text-amber-950 border border-amber-300/80">
                <Sparkles className="w-3 h-3 text-amber-700" /> Cảnh báo an toàn dữ liệu
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Khuyến nghị thiết lập bảo vệ dự phòng
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Phòng khám chưa kết nối Google Drive & Google Sheets cá nhân
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mặc dù hệ thống đang lưu trữ dữ liệu an toàn trên cơ sở dữ liệu đám mây <strong className="text-slate-800">Neon</strong>, việc kết nối tài khoản Google cá nhân của phòng khám là bước bảo đảm then chốt để:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tự động đồng bộ lịch sử đặt hẹn sang <strong>Google Sheets</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 font-medium bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Lưu trữ phim chụp X-quang & hồ sơ bệnh án vào <strong>Google Drive</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0">
          <button
            type="button"
            onClick={handleQuickConnect}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md hover:from-teal-700 hover:to-emerald-700 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <Cloud className="w-4 h-4" />
            <span>{isConnecting ? 'Đang mở đăng nhập...' : 'Kết nối Google ngay'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300/80 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>Xem cấu hình chi tiết</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="text-[11px] text-slate-500 hover:text-slate-800 text-center md:text-right mt-0.5"
          >
            Để sau (tạm ẩn phiên này)
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`mt-3 pt-2.5 border-t border-amber-200 text-xs font-medium flex items-center gap-2 ${
          syncMsg.type === 'success' ? 'text-emerald-800' : 'text-rose-700'
        }`}>
          <span>{syncMsg.text}</span>
        </div>
      )}
    </div>
  );
};
export default GoogleBackupWarningBanner;
