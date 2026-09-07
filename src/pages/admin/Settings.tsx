import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { 
  Send, 
  Mail, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  HelpCircle, 
  Shield, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  CheckCircle2,
  HeartHandshake,
  MessageSquarePlus,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Lock,
  Cloud,
  HardDrive,
  FileSpreadsheet,
  ExternalLink,
  LogOut,
  Database,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { 
  findOrCreateClinicSpreadsheet, 
  syncAppointmentsToSheet, 
  fetchDriveQuota, 
  formatBytes 
} from '../../lib/googleWorkspace';

declare global {
  interface Window {
    google: any;
  }
}

export default function Settings() {
  const { 
    isConnected: isGoogleConnected, 
    accessToken: googleToken, 
    user: googleUser, 
    connect: connectGoogleStore, 
    disconnect: disconnectGoogleStore,
    spreadsheetId,
    spreadsheetUrl,
    setSpreadsheetInfo,
    lastSyncAt,
    setLastSyncAt
  } = useGoogleAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isUserError, setIsUserError] = useState(false);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [driveInfo, setDriveInfo] = useState<any>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingAppointments, setIsSyncingAppointments] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualSheetInput, setManualSheetInput] = useState('');

  // Telegram Config
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [telegramMsg, setTelegramMsg] = useState('');
  const [telegramTesting, setTelegramTesting] = useState(false);

  // Email Config (SMTP)
  const [emailConfig, setEmailConfig] = useState({
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });
  const [testRecipient, setTestRecipient] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailTesting, setEmailTesting] = useState(false);
  const [showEmailHelp, setShowEmailHelp] = useState(false);

  const [clinicProfile, setClinicProfile] = useState({
    clinicName: '',
    doctorName: '',
    address: '',
    phone: '',
    workingHours: '',
    slogan: '',
  });
  const [clinicMsg, setClinicMsg] = useState('');

  // Cấu hình Trang Hồ Sơ Tiếp Đón Chu Đáo
  const DEFAULT_TAGS = [
    'Đang đau nhức / Ê buốt',
    'Sợ đau / Nhạy cảm',
    'Muốn được tư vấn kỹ',
    'Khám răng định kỳ',
    'Cần xuất hóa đơn'
  ];
  const [bookingFormConfig, setBookingFormConfig] = useState({
    showNotificationChannels: true,
    showHoldCountdown: true,
    quickNotesTags: DEFAULT_TAGS,
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [bookingFormMsg, setBookingFormMsg] = useState('');
  const [bookingFormLoading, setBookingFormLoading] = useState(false);

  const handleSaveBookingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFormLoading(true);
    setBookingFormMsg('');
    try {
      await api.post('/admin/settings', { bookingFormConfig });
      setBookingFormMsg('✅ Lưu cấu hình trang Hồ Sơ Tiếp Đón thành công!');
      setTimeout(() => setBookingFormMsg(''), 4000);
    } catch (err: any) {
      setBookingFormMsg('❌ ' + (err.response?.data?.error?.message || 'Có lỗi xảy ra khi lưu'));
    } finally {
      setBookingFormLoading(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (bookingFormConfig.quickNotesTags.includes(trimmed)) {
      return;
    }
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: [...prev.quickNotesTags, trimmed]
    }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: prev.quickNotesTags.filter(t => t !== tagToRemove)
    }));
  };

  const handleResetDefaultTags = () => {
    setBookingFormConfig(prev => ({
      ...prev,
      quickNotesTags: [...DEFAULT_TAGS]
    }));
  };

  const [backupData, setBackupData] = useState('');
  const [dataMsg, setDataMsg] = useState('');
  const [isDataError, setIsDataError] = useState(false);

  // Safe Wipe Data Modal States
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  const handleBackup = async () => {
    try {
      const res = await api.get('/admin/backup');
      const dataStr = JSON.stringify(res.data.data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dental_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsDataError(false);
      setDataMsg('Backup tải xuống thành công');
    } catch (e: any) {
      setIsDataError(true);
      setDataMsg('Lỗi khi backup: ' + (e.response?.data?.error?.message || e.message));
    }
  };

  const handleRestore = async () => {
    if (!backupData) return;
    try {
      const data = JSON.parse(backupData);
      await api.post('/admin/restore', { data });
      setIsDataError(false);
      setDataMsg('Restore dữ liệu thành công. Hãy tải lại trang.');
    } catch (e: any) {
      setIsDataError(true);
      setDataMsg('Lỗi khi restore: Dữ liệu JSON không hợp lệ hoặc lỗi server.');
    }
  };

  const handleExecuteWipe = async () => {
    const trimmed = wipeConfirmInput.trim().toUpperCase();
    if (trimmed !== 'XOA DU LIEU' && trimmed !== 'WIPE') {
      return;
    }
    setIsWiping(true);
    setDataMsg('');
    setIsDataError(false);

    try {
      const res = await api.post('/admin/wipe');
      const successMessage = res.data?.message || 'Đã xóa sạch toàn bộ dữ liệu phòng khám thành công.';
      setDataMsg(successMessage);
      setIsDataError(false);
      setIsWipeModalOpen(false);
      setWipeConfirmInput('');
    } catch (e: any) {
      const errMsg = e.response?.data?.error?.message || e.response?.data?.message || e.message || 'Lỗi khi xóa dữ liệu.';
      setDataMsg('Lỗi khi xóa dữ liệu: ' + errMsg);
      setIsDataError(true);
    } finally {
      setIsWiping(false);
    }
  };

  useEffect(() => {
    api.get('/admin/settings').then(res => {
      const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig: dbEmailConfig, bookingFormConfig: dbBookingFormConfig } = res.data.data || {};
      if (telegramToken) setTelegramToken(telegramToken);
      if (telegramChatId) setTelegramChatId(telegramChatId);
      if (telegramBotUsername) setTelegramBotUsername(telegramBotUsername);
      if (clinicProfile) setClinicProfile(clinicProfile);
      if (dbBookingFormConfig) {
        setBookingFormConfig(prev => ({
          ...prev,
          showNotificationChannels: dbBookingFormConfig.showNotificationChannels !== false,
          showHoldCountdown: dbBookingFormConfig.showHoldCountdown !== false,
          quickNotesTags: Array.isArray(dbBookingFormConfig.quickNotesTags) ? dbBookingFormConfig.quickNotesTags : DEFAULT_TAGS,
        }));
      }
      if (dbEmailConfig) {
        setEmailConfig(prev => ({ ...prev, ...dbEmailConfig }));
        if (dbEmailConfig.user && !testRecipient) {
          setTestRecipient(dbEmailConfig.user);
        }
      }
    }).catch(console.error);

    // Tải danh sách tài khoản hiện có
    api.get('/users').then(res => {
      if (res.data?.data) {
        setUserAccounts(res.data.data);
      }
    }).catch(() => {});
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    setIsUserError(false);
    try {
      const trimmedIdentifier = email.trim();
      const res = await api.post('/users', { 
        username: trimmedIdentifier,
        email: trimmedIdentifier,
        password 
      });
      setMsg(res.data?.message || `Tạo tài khoản '${trimmedIdentifier}' thành công!`);
      setIsUserError(false);
      setEmail('');
      setPassword('');
      // Làm mới danh sách tài khoản
      const refreshed = await api.get('/users');
      if (refreshed.data?.data) {
        setUserAccounts(refreshed.data.data);
      }
    } catch (err: any) {
      setIsUserError(true);
      setMsg(err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra khi tạo tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchDriveQuota(googleToken).then(data => {
        if (data) setDriveInfo(data);
      });
    }
  }, [googleToken]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setGoogleStatusMsg(null);
    try {
      const { accessToken } = await connectGoogleStore();
      const quota = await fetchDriveQuota(accessToken);
      if (quota) setDriveInfo(quota);

      // Try finding or creating the clinic's Google Sheet automatically
      try {
        const sheetInfo = await findOrCreateClinicSpreadsheet(accessToken, 'Dental Smart');
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
        setGoogleStatusMsg({
          type: 'success',
          text: `Đã kết nối Google và liên kết bảng tính: Dental Smart - Lịch hẹn & Hồ sơ phòng khám`
        });
      } catch (sheetErr) {
        console.warn('Auto spreadsheet init:', sheetErr);
        setGoogleStatusMsg({
          type: 'success',
          text: `Đã kết nối tài khoản Google thành công!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg({
        type: 'error',
        text: err.message || 'Không thể kết nối tài khoản Google. Vui lòng thử lại.'
      });
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (window.confirm('Bạn có chắc chắn muốn ngắt kết nối tài khoản Google khỏi hệ thống phòng khám?')) {
      await disconnectGoogleStore();
      setDriveInfo(null);
      setGoogleStatusMsg({
        type: 'success',
        text: 'Đã ngắt kết nối tài khoản Google.'
      });
    }
  };

  const handleSyncAllAppointments = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({
        type: 'error',
        text: 'Vui lòng kết nối tài khoản Google trước khi đồng bộ.'
      });
      return;
    }

    setIsSyncingAppointments(true);
    setGoogleStatusMsg(null);
    try {
      let targetSheetId = spreadsheetId;
      if (!targetSheetId) {
        const sheetInfo = await findOrCreateClinicSpreadsheet(googleToken, 'Dental Smart');
        targetSheetId = sheetInfo.spreadsheetId;
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
      }

      const res = await api.get('/appointments');
      const allAppts = res.data?.data || [];
      const syncResult = await syncAppointmentsToSheet(allAppts, googleToken, targetSheetId);

      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSyncAt(timeStr);
      setGoogleStatusMsg({
        type: 'success',
        text: `Đã đồng bộ thành công toàn bộ ${syncResult.count} lịch hẹn sang Google Sheets lúc ${timeStr}!`
      });
    } catch (e: any) {
      console.error('Lỗi đồng bộ lịch hẹn:', e);
      setGoogleStatusMsg({
        type: 'error',
        text: 'Lỗi đồng bộ lịch hẹn: ' + (e.message || 'Vui lòng kiểm tra quyền truy cập Google Sheets.')
      });
    } finally {
      setIsSyncingAppointments(false);
    }
  };

  const handleSaveManualSheet = () => {
    if (!manualSheetInput.trim()) return;
    const cleanId = manualSheetInput.trim();
    const url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    setSpreadsheetInfo(cleanId, url);
    setManualSheetInput('');
    setGoogleStatusMsg({
      type: 'success',
      text: `Đã lưu cấu hình Google Spreadsheet ID: ${cleanId}`
    });
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramMsg('');
    try {
      await api.post('/admin/settings', { 
        telegramToken, 
        telegramChatId,
        telegramBotUsername: telegramBotUsername.trim().replace(/^@/, '')
      });
      setTelegramMsg('✅ Lưu cấu hình Telegram thành công!');
    } catch (err: any) {
      setTelegramMsg('❌ ' + (err.response?.data?.error?.message || 'Có lỗi xảy ra'));
    }
  };

  const handleTestTelegram = async () => {
    setTelegramTesting(true);
    setTelegramMsg('');
    try {
      const res = await api.post('/admin/settings/test-telegram', { telegramChatId });
      setTelegramMsg('✅ ' + (res.data.message || 'Đã gửi tin nhắn kiểm tra thành công!'));
    } catch (err: any) {
      setTelegramMsg('❌ ' + (err.response?.data?.error?.message || 'Không thể gửi tin nhắn Telegram'));
    } finally {
      setTelegramTesting(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg('');
    try {
      await api.post('/admin/settings', { emailConfig });
      setEmailMsg('✅ Lưu cấu hình Email (SMTP) thành công!');
    } catch (err: any) {
      setEmailMsg('❌ ' + (err.response?.data?.error?.message || 'Có lỗi xảy ra'));
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    setEmailMsg('');
    try {
      const res = await api.post('/admin/settings/test-email', { 
        emailConfig,
        recipientEmail: testRecipient || emailConfig.user
      });
      setEmailMsg('✅ ' + (res.data.message || 'Kết nối SMTP và gửi email thành công!'));
    } catch (err: any) {
      setEmailMsg('❌ ' + (err.response?.data?.error?.message || 'Không thể gửi email kiểm tra. Vui lòng kiểm tra lại mật khẩu ứng dụng / Host'));
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setClinicMsg('');
    try {
      await api.post('/admin/settings', { clinicProfile });
      setClinicMsg('Lưu thông tin phòng khám thành công!');
    } catch (err: any) {
      setClinicMsg(err.response?.data?.error?.message || 'Có lỗi xảy ra');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">

      {/* Telegram Config */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            Cấu hình Telegram Bot (Admin & Bệnh nhân)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSaveTelegram}>
            {telegramMsg && (
              <div className={`text-xs p-2.5 rounded-md ${telegramMsg.startsWith('✅') ? 'bg-mint text-primary' : 'bg-red-50 text-red-700'}`}>
                {telegramMsg}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main">Telegram Bot Token</label>
              <Input 
                type="text" 
                placeholder="VD: 7123456789:AAHq..." 
                value={telegramToken} 
                onChange={e => setTelegramToken(e.target.value)} 
                className="text-xs"
              />
              <p className="text-[11px] text-text-muted">Lấy từ @BotFather trên Telegram.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main">Admin Chat ID (Nhận thông báo khi có lịch mới)</label>
              <Input 
                type="text" 
                placeholder="VD: 123456789" 
                value={telegramChatId} 
                onChange={e => setTelegramChatId(e.target.value)} 
                className="text-xs"
              />
              <p className="text-[11px] text-text-muted">Chat ID nhận thông báo quản trị viên và duyệt lịch hẹn trực tiếp.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-main">Bot Username (Bỏ chữ @)</label>
              <Input 
                type="text" 
                placeholder="VD: NhaKhoaSmartBot" 
                value={telegramBotUsername} 
                onChange={e => setTelegramBotUsername(e.target.value)} 
                className="text-xs"
              />
              <p className="text-[11px] text-text-muted">Dùng để tạo liên kết tự động kết nối 1-click cho bệnh nhân (t.me/Bot?start=...).</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button type="submit" className="flex-1 text-xs">
                Lưu cấu hình Telegram
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestTelegram} 
                disabled={telegramTesting || !telegramToken || !telegramChatId}
                className="text-xs shrink-0"
              >
                {telegramTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Gửi tin nhắn thử nghiệm
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Email Config (SMTP) */}
      <Card className="col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Cấu hình Dịch vụ Gửi Email (SMTP)
            </CardTitle>
            <button 
              type="button" 
              onClick={() => setShowEmailHelp(!showEmailHelp)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Hướng dẫn
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {showEmailHelp && (
            <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5 leading-relaxed">
              <p className="font-semibold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-600" /> Cách cấu hình Gmail miễn phí (Khuyên dùng):
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li>Truy cập Google Account &gt; <strong>Bảo mật (Security)</strong> &gt; Bật Xác minh 2 bước.</li>
                <li>Tìm kiếm <strong>Mật khẩu ứng dụng (App Passwords)</strong> &gt; Tạo mật khẩu mới (16 ký tự).</li>
                <li>Điền <strong>smtp.gmail.com</strong>, cổng <strong>587</strong> (hoặc 465), tài khoản Gmail và dán mã 16 ký tự vào ô Mật khẩu.</li>
              </ol>
            </div>
          )}

          <form className="space-y-3.5" onSubmit={handleSaveEmail}>
            {emailMsg && (
              <div className={`text-xs p-2.5 rounded-md ${emailMsg.startsWith('✅') ? 'bg-mint text-primary' : 'bg-red-50 text-red-700'}`}>
                {emailMsg}
              </div>
            )}

            <div className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-md">
              <div>
                <p className="text-xs font-semibold text-text-main">Bật thông báo Email tự động cho bệnh nhân</p>
                <p className="text-[11px] text-text-muted">Tự động gửi email xác nhận và thẻ khám điện tử khi đặt lịch thành công</p>
              </div>
              <input 
                type="checkbox" 
                checked={emailConfig.enabled}
                onChange={e => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-text-main">Máy chủ SMTP (Host)</label>
                <Input 
                  type="text" 
                  placeholder="VD: smtp.gmail.com" 
                  value={emailConfig.host} 
                  onChange={e => setEmailConfig({ ...emailConfig, host: e.target.value })} 
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-main">Cổng (Port)</label>
                <Input 
                  type="number" 
                  placeholder="587 hoặc 465" 
                  value={emailConfig.port} 
                  onChange={e => setEmailConfig({ ...emailConfig, port: parseInt(e.target.value) || 587 })} 
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-main">Tài khoản SMTP (Email gửi)</label>
              <Input 
                type="email" 
                placeholder="VD: phongkham.nhakhoa@gmail.com" 
                value={emailConfig.user} 
                onChange={e => setEmailConfig({ ...emailConfig, user: e.target.value })} 
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-main">Mật khẩu ứng dụng (App Password)</label>
              <Input 
                type="password" 
                placeholder="Mật khẩu 16 ký tự Gmail hoặc SMTP pass" 
                value={emailConfig.pass} 
                onChange={e => setEmailConfig({ ...emailConfig, pass: e.target.value })} 
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-main">Tên người gửi hiển thị (From Name)</label>
              <Input 
                type="text" 
                placeholder="VD: Nha Khoa Dental Smart <phongkham@gmail.com>" 
                value={emailConfig.from} 
                onChange={e => setEmailConfig({ ...emailConfig, from: e.target.value })} 
                className="text-xs h-8"
              />
            </div>

            {/* Test Email Row */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <Input 
                type="email" 
                placeholder="Email nhận thư thử nghiệm..." 
                value={testRecipient} 
                onChange={e => setTestRecipient(e.target.value)} 
                className="text-xs h-8 flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleTestEmail} 
                disabled={emailTesting || !emailConfig.host || !emailConfig.user}
                className="text-xs h-8 shrink-0"
              >
                {emailTesting ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                Kiểm tra & Gửi thử
              </Button>
            </div>

            <Button type="submit" className="w-full text-xs">
              Lưu cấu hình Email (SMTP)
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Clinic Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin Phòng khám</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSaveClinic}>
            {clinicMsg && <div className="text-sm text-primary bg-mint p-2 rounded">{clinicMsg}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Tên phòng khám</label>
              <Input 
                type="text" 
                placeholder="VD: Nha khoa Lê Phương" 
                value={clinicProfile.clinicName} 
                onChange={e => setClinicProfile({...clinicProfile, clinicName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main flex items-center justify-between">
                <span>Slogan / Khẩu hiệu phòng khám</span>
                <span className="text-xs text-text-muted">Tùy chọn</span>
              </label>
              <Input 
                type="text" 
                placeholder="VD: Nụ cười rạng rỡ - Tương lai tươi sáng" 
                value={clinicProfile.slogan || ''} 
                onChange={e => setClinicProfile({...clinicProfile, slogan: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Bác sĩ phụ trách</label>
              <Input 
                type="text" 
                placeholder="VD: Lê Thị Diễm Phương" 
                value={clinicProfile.doctorName} 
                onChange={e => setClinicProfile({...clinicProfile, doctorName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Địa chỉ</label>
              <Input 
                type="text" 
                placeholder="VD: 123 Nguyễn Văn Cừ, Quận 5, TP.HCM" 
                value={clinicProfile.address} 
                onChange={e => setClinicProfile({...clinicProfile, address: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Hotline</label>
              <Input 
                type="text" 
                placeholder="VD: 0901 234 567" 
                value={clinicProfile.phone} 
                onChange={e => setClinicProfile({...clinicProfile, phone: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Giờ làm việc</label>
              <Input 
                type="text" 
                placeholder="VD: 08:00 - 20:00 (Thứ 2 - Thứ 7)" 
                value={clinicProfile.workingHours} 
                onChange={e => setClinicProfile({...clinicProfile, workingHours: e.target.value})} 
              />
            </div>
            <p className="text-[11px] text-text-muted">
              💡 Thông tin phòng khám và slogan sẽ tự động hiển thị trang trọng trên trang đặt lịch của khách hàng để cá nhân hóa thương hiệu.
            </p>
            <Button type="submit" className="w-full">Lưu thông tin phòng khám</Button>
          </form>
        </CardContent>
      </Card>

      {/* Cấu hình Trang Hồ Sơ Tiếp Đón Chu Đáo (Bước 3) */}
      <Card className="col-span-1 md:col-span-2 border-teal-200/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <HeartHandshake className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Cấu hình Trang "Hồ Sơ Tiếp Đón Chu Đáo" (Bước 3)</CardTitle>
                <p className="text-xs text-text-muted mt-0.5">
                  Tùy biến các trường thông tin và mục chọn nhanh trên giao diện đặt hẹn của bệnh nhân
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/80 self-start sm:self-auto">
              Trang đặt lịch Online
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {bookingFormMsg && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold border ${
              bookingFormMsg.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {bookingFormMsg}
            </div>
          )}

          <form onSubmit={handleSaveBookingForm} className="space-y-6">
            {/* Mục 1: Ẩn / Hiện Kênh nhận vé khám & nhắc hẹn thông minh */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold text-slate-800">
                      Kênh nhận vé khám & nhắc hẹn thông minh (Email & Telegram)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                    Khi bật, bệnh nhân có thể nhập email nhận vé điện tử (E-Ticket) và kết nối nhận thông báo nhắc lịch tự động qua Telegram. Nếu tắt, phần này sẽ được ẩn hoàn toàn để form ngắn gọn nhất.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBookingFormConfig(prev => ({ ...prev, showNotificationChannels: !prev.showNotificationChannels }))}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    bookingFormConfig.showNotificationChannels ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      bookingFormConfig.showNotificationChannels ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border ${
                  bookingFormConfig.showNotificationChannels
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {bookingFormConfig.showNotificationChannels ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      Đang HIỆN trên form khách hàng
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      Đang ẨN trên form khách hàng
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Mục 2: Ẩn / Hiện thông tin thời gian giữ chỗ riêng (5 phút đếm ngược) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold text-slate-800">
                      Thông tin thời gian giữ chỗ riêng (5 phút đếm ngược)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                    Khi bật, hệ thống sẽ hiển thị đồng hồ đếm ngược 5 phút giữ chỗ ở tiêu đề Hồ sơ tiếp đón và trên Phiếu đặt hẹn để bệnh nhân yên tâm ca khám được giữ riêng. Khi tắt, các nhãn đếm ngược này sẽ được ẩn để biểu mẫu mang lại cảm giác thư thái, không gây áp lực thời gian.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBookingFormConfig(prev => ({ ...prev, showHoldCountdown: !prev.showHoldCountdown }))}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    bookingFormConfig.showHoldCountdown ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      bookingFormConfig.showHoldCountdown ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border ${
                  bookingFormConfig.showHoldCountdown
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {bookingFormConfig.showHoldCountdown ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      Đang HIỆN đồng hồ đếm ngược 5 phút
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      Đang ẨN đồng hồ đếm ngược 5 phút
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Mục 3: Cấu hình các mục chọn nhanh Tình trạng & Lời nhắn */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquarePlus className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-bold text-slate-800">
                      Mục chọn nhanh: Tình trạng răng miệng & Lời nhắn gửi bác sĩ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Bệnh nhân có thể bấm chọn nhanh các mục này (chọn nhiều) để tự động thêm vào ghi chú tiếp đón
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaultTags}
                  className="text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Mặc định ban đầu
                </Button>
              </div>

              {/* Danh sách Tags hiện tại */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Danh sách mục chọn nhanh hiện có ({bookingFormConfig.quickNotesTags.length} mục):
                </label>
                <div className="flex flex-wrap gap-2 min-h-[42px] p-3 bg-white rounded-xl border border-slate-200">
                  {bookingFormConfig.quickNotesTags.length === 0 ? (
                    <span className="text-xs text-slate-400 italic py-1">
                      Chưa có mục nào. Hãy nhập nội dung bên dưới và bấm "Thêm mục".
                    </span>
                  ) : (
                    bookingFormConfig.quickNotesTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs group"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          title={`Xóa mục "${tag}"`}
                          className="w-4 h-4 rounded-full inline-flex items-center justify-center text-teal-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Form thêm tag mới */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Thêm mục chọn nhanh mới:</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="VD: Đang mang thai, Sợ tiêm, Khám cùng người thân, Răng nhạy cảm..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="outline"
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-teal-700 border-teal-300 hover:bg-teal-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-teal-600" />
                    Thêm mục
                  </Button>
                </div>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/30 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-teal-600" />
                Mô phỏng hiển thị trên trang bệnh nhân (Live Preview):
              </div>
              
              <div className="rounded-xl bg-white p-4 border border-slate-200/90 shadow-xs space-y-4 text-xs">
                {/* Notification Channels Preview */}
                {bookingFormConfig.showNotificationChannels ? (
                  <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-100 flex items-center justify-between">
                    <span className="font-semibold text-teal-900 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-teal-600" />
                      Kênh nhận vé khám & nhắc hẹn thông minh (Email & Telegram): ĐANG HIỂN THỊ
                    </span>
                    <span className="text-[10px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                      Bệnh nhân có thể nhập
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 italic">
                    (Mục nhận vé khám & Telegram đã được ẩn khỏi form)
                  </div>
                )}

                {/* Hold Countdown Timer Preview */}
                {bookingFormConfig.showHoldCountdown ? (
                  <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-100 flex items-center justify-between">
                    <span className="font-semibold text-teal-900 flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5 text-teal-600" />
                      Thời gian giữ chỗ riêng 5 phút: ĐANG HIỂN THỊ
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      <Lock className="w-3 h-3" />
                      Giữ chỗ riêng: 4:51
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 italic flex items-center gap-2">
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>(Đồng hồ đếm ngược 5 phút giữ chỗ đã được ẩn khỏi tiêu đề & phiếu tóm tắt)</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <MessageSquarePlus className="w-3.5 h-3.5 text-teal-600" />
                    Mục chọn nhanh tình trạng & lời nhắn ({bookingFormConfig.quickNotesTags.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bookingFormConfig.quickNotesTags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        + {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={bookingFormLoading} className="w-full sm:w-auto font-bold px-8 cursor-pointer">
              {bookingFormLoading ? 'Đang lưu cấu hình...' : 'Lưu cấu hình Hồ Sơ Tiếp Đón'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User Creation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tạo tài khoản Quản trị</CardTitle>
            <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              Không bắt buộc @
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleCreateUser}>
            {msg && (
              <div className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                isUserError 
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' 
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
              }`}>
                {isUserError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{msg}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-main flex items-center justify-between">
                <span>Tên tài khoản / Email</span>
                <span className="text-xs text-text-muted">Tùy ý (VD: admin, quanly)</span>
              </label>
              <Input 
                type="text" 
                placeholder="VD: admin hoặc admin@phongkham.vn" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                autoComplete="off"
              />
              <p className="text-[11px] text-text-muted">
                Admin có thể đặt tên tài khoản tùy ý (VD: <strong>admin</strong>, <strong>bacsi1</strong>) hoặc địa chỉ email. Không bắt buộc phải có ký tự @.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-main">Mật khẩu</label>
              <Input 
                type="password" 
                placeholder="Tối thiểu 6 ký tự (VD: admin@123)" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Đang khởi tạo...
                </>
              ) : (
                'Tạo tài khoản quản trị'
              )}
            </Button>
          </form>

          {userAccounts.length > 0 && (
            <div className="pt-3 border-t border-border-subtle space-y-2">
              <p className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Danh sách tài khoản hệ thống ({userAccounts.length}):
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {userAccounts.map((u, idx) => (
                  <div key={u.id || idx} className="flex items-center justify-between text-xs p-2 rounded bg-bg-base border border-border-subtle">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-medium text-text-main">{u.email}</span>
                    </div>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                      {u.roleName || 'admin'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>Quản lý Dữ liệu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataMsg && (
            <div className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
              isDataError 
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' 
                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
            }`}>
              {isDataError ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{dataMsg}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 border p-4 rounded bg-bg-base flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-text-main">Backup Dữ liệu</h3>
                <p className="text-sm text-text-muted">Tải xuống toàn bộ dữ liệu (bệnh nhân, lịch hẹn, dịch vụ, cấu hình) dưới dạng JSON.</p>
              </div>
              <Button onClick={handleBackup} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Tải Backup</Button>
            </div>

            <div className="space-y-2 border p-4 rounded bg-bg-base flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-text-main">Khôi phục (Restore)</h3>
                <p className="text-sm text-text-muted">Tải lên file JSON backup để khôi phục dữ liệu.</p>
                <input 
                  type="file" 
                  accept=".json"
                  className="w-full text-sm border border-border-subtle rounded file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 mt-2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setBackupData(ev.target?.result as string);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </div>
              <Button onClick={handleRestore} variant="outline" className="w-full" disabled={!backupData}>Restore</Button>
            </div>

            <div className="space-y-2.5 border border-status-cancelled p-4 rounded bg-status-cancelled-bg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-400 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    Wipe Data
                  </h3>
                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                    Phòng khám
                  </span>
                </div>
                <p className="text-sm text-status-cancelled mb-2">
                  Xóa SẠCH toàn bộ dữ liệu hiện có trong hệ thống.
                </p>
                <div className="text-[11px] bg-white/80 dark:bg-surface-subtle p-2 rounded border border-emerald-300/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-0.5 mb-2">
                  <div className="font-semibold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Bảo tồn an toàn:
                  </div>
                  <p className="text-text-muted text-[11px] leading-tight">
                    Tài khoản <strong>admin@dentalsmartbooking.com</strong> & mật khẩu mặc định <strong>admin@123</strong> không bị xóa.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setWipeConfirmInput('');
                  setIsWipeModalOpen(true);
                }} 
                variant="destructive" 
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Xóa toàn bộ dữ liệu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Xác nhận Wipe Data An toàn */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-2xl border border-border-subtle max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">Xác nhận Wipe Data Phòng Khám</h3>
                  <p className="text-xs text-text-muted">Chỉ xóa dữ liệu phòng khám, bảo tồn tài khoản admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isWiping && setIsWipeModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-lg transition-colors cursor-pointer"
                disabled={isWiping}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg text-red-800 dark:text-red-300 text-xs leading-relaxed">
                <strong>CẢNH BÁO QUAN TRỌNG:</strong> Thao tác này sẽ xóa sạch toàn bộ hồ sơ hoạt động của phòng khám. Sau khi xóa, bạn sẽ không thể phục hồi nếu chưa tải xuống bản <strong>Backup</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                  <p className="font-bold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Dữ liệu sẽ XÓA SẠCH:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-red-600 dark:text-red-300">
                    <li>Toàn bộ Lịch hẹn khám</li>
                    <li>Toàn bộ Hồ sơ Bệnh nhân</li>
                    <li>Danh sách giữ chỗ trực tuyến</li>
                    <li>Danh sách chờ (Waitlist)</li>
                    <li>Lịch nhắc tái khám</li>
                    <li>Đăng ký thông báo push</li>
                    <li>Nhật ký kiểm toán hệ thống</li>
                  </ul>
                </div>

                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-lg">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> BẢO VỆ TUYỆT ĐỐI:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-emerald-700 dark:text-emerald-300">
                    <li><strong>Admin email:</strong> admin@dentalsmartbooking.com</li>
                    <li><strong>Mật khẩu mặc định:</strong> admin@123</li>
                    <li><strong>Quyền:</strong> Quản trị tối cao (Admin)</li>
                    <li><strong>Khởi tạo lại:</strong> Dịch vụ chuẩn & Bác sĩ mặc định để tiếp tục hoạt động ngay</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-text-main block">
                  Để xác nhận, vui lòng nhập chữ <span className="text-red-600 font-bold">XOA DU LIEU</span> vào ô bên dưới:
                </label>
                <Input
                  type="text"
                  placeholder="Nhập XOA DU LIEU để xác nhận"
                  value={wipeConfirmInput}
                  onChange={(e) => setWipeConfirmInput(e.target.value)}
                  disabled={isWiping}
                  className="w-full text-sm border-red-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWipeModalOpen(false)}
                disabled={isWiping}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleExecuteWipe}
                disabled={
                  (wipeConfirmInput.trim().toUpperCase() !== 'XOA DU LIEU' &&
                   wipeConfirmInput.trim().toUpperCase() !== 'WIPE') ||
                  isWiping
                }
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWiping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang dọn dẹp dữ liệu...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Xác nhận Xóa Sạch Dữ Liệu
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Workspace Integration & Backup */}
      <Card className="col-span-1 md:col-span-2 border-slate-200 overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                isGoogleConnected ? 'bg-emerald-600' : 'bg-amber-500'
              }`}>
                {isGoogleConnected ? <Cloud className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Tích hợp Google Workspace & Sao lưu dự phòng
                  {isGoogleConnected ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Đang bảo vệ kép
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Chưa kích hoạt
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-text-muted mt-0.5">
                  Lưu trữ hồ sơ X-quang vào Google Drive và đồng bộ toàn bộ lịch hẹn sang Google Sheets
                </p>
              </div>
            </div>

            {isGoogleConnected && (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-2xs self-start sm:self-center"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ngắt kết nối Google</span>
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Neon & Google Dual Protection Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Cơ chế bảo toàn dữ liệu phòng khám:</span>
            </div>
            <p>
              Hệ thống hiện vận hành với cơ sở dữ liệu chính quy trên đám mây <strong className="text-slate-900">Neon</strong>. 
              Việc kết nối thêm tài khoản <strong className="text-slate-900">Google cá nhân</strong> của phòng khám tạo nên lớp bảo vệ ngoại vi độc lập: lịch hẹn được lưu thành các hàng trực quan trong Google Sheets (dễ dàng xuất báo cáo Excel bất cứ lúc nào), còn tài liệu, phim chụp răng, ảnh X-quang được lưu trực tiếp trên Google Drive không lo giới hạn dung lượng máy chủ.
            </p>
          </div>

          {/* Feedback message */}
          {googleStatusMsg && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              googleStatusMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {googleStatusMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{googleStatusMsg.text}</span>
            </div>
          )}

          {!isGoogleConnected ? (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-6 sm:p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-slate-900">Chưa liên kết tài khoản Google</h4>
                <p className="text-xs text-slate-600">
                  Nhấn nút bên dưới để đăng nhập tài khoản Google của bạn. Hệ thống sẽ tự động tạo bảng tính Google Sheets và thư mục Google Drive chuyên dụng cho Dental Smart.
                </p>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleConnectGoogle} 
                  disabled={isConnectingGoogle}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isConnectingGoogle ? 'Đang mở đăng nhập Google...' : 'Kết nối Google Drive & Sheets ngay'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-4 text-left">
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-slate-800 font-semibold">Bảng tính Google Sheets</strong>
                    <span className="text-slate-500">Đồng bộ lịch hẹn & hồ sơ bệnh nhân theo thời gian thực</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5">
                  <HardDrive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block text-slate-800 font-semibold">Ổ lưu trữ Google Drive</strong>
                    <span className="text-slate-500">Lưu ảnh phim X-quang, hóa đơn và bệnh án an toàn</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Profile Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 gap-4">
                <div className="flex items-center gap-3">
                  {googleUser?.photoURL ? (
                    <img 
                      src={googleUser.photoURL} 
                      alt="Google avatar" 
                      className="w-12 h-12 rounded-full border-2 border-white shadow-xs" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                      {googleUser?.displayName ? googleUser.displayName.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {googleUser?.displayName || 'Tài khoản Google phòng khám'}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/90 text-emerald-900">
                        Đã xác thực
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600">{googleUser?.email}</p>
                    {lastSyncAt && (
                      <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                        Đã đồng bộ lịch hẹn gần nhất lúc: {lastSyncAt}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSyncAllAppointments}
                    disabled={isSyncingAppointments}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAppointments ? 'animate-spin' : ''}`} />
                    <span>{isSyncingAppointments ? 'Đang đồng bộ...' : 'Đồng bộ toàn bộ lịch hẹn'}</span>
                  </Button>
                </div>
              </div>

              {/* 2 Columns: Google Sheets & Google Drive */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Google Sheets Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Google Sheets Lịch hẹn & Bệnh án
                      </h4>
                    </div>
                    {spreadsheetUrl && (
                      <a
                        href={spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        <span>Mở Bảng tính</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-slate-600">
                    Bảng tính chứa hai trang tính chuyên biệt: <code className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.5 rounded">Lịch hẹn</code> và <code className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.5 rounded">Hồ sơ bệnh nhân</code>.
                  </p>

                  <div className="pt-1 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Mã bảng tính (ID):</span>
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={spreadsheetId || ''}>
                        {spreadsheetId || 'Chưa liên kết'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Input
                        placeholder="Nhập ID Spreadsheet nếu muốn thay đổi..."
                        value={manualSheetInput}
                        onChange={(e) => setManualSheetInput(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveManualSheet}
                        disabled={!manualSheetInput.trim()}
                        className="text-xs h-8 shrink-0"
                      >
                        Lưu ID
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Google Drive Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Google Drive Lưu trữ File
                      </h4>
                    </div>
                    <a
                      href="https://drive.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <span>Mở Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {driveInfo ? (
                    <div className="space-y-2">
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/80">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(2, (parseInt(driveInfo.usage || '0') / Math.max(1, parseInt(driveInfo.limit || '1'))) * 100))}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-slate-500 flex justify-between font-medium">
                        <span>Đã dùng: {formatBytes(driveInfo.usage || '0')}</span>
                        <span>Tổng dung lượng: {formatBytes(driveInfo.limit || '0')}</span>
                      </div>
                      {parseInt(driveInfo.limit || '0') > 0 && (parseInt(driveInfo.usage || '0') / parseInt(driveInfo.limit || '1')) > 0.9 && (
                        <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Dung lượng Google Drive sắp đầy!
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Tự động tải lên phim X-quang, hồ sơ bệnh án và file đính kèm trực tiếp vào thư mục an toàn của phòng khám trên Google Drive.
                    </p>
                  )}

                  <div className="pt-1">
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/70 inline-block">
                      Thư mục lưu trữ: 📁 Dental Smart Clinic Files
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
