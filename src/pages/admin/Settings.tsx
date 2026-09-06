import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { Send, Mail, Check, AlertCircle, RefreshCw, HelpCircle, Shield, Trash2, ShieldCheck, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

export default function Settings() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [driveInfo, setDriveInfo] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

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
    workingHours: ''
  });
  const [clinicMsg, setClinicMsg] = useState('');

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
      const { telegramToken, telegramChatId, telegramBotUsername, clinicProfile, emailConfig: dbEmailConfig } = res.data.data || {};
      if (telegramToken) setTelegramToken(telegramToken);
      if (telegramChatId) setTelegramChatId(telegramChatId);
      if (telegramBotUsername) setTelegramBotUsername(telegramBotUsername);
      if (clinicProfile) setClinicProfile(clinicProfile);
      if (dbEmailConfig) {
        setEmailConfig(prev => ({ ...prev, ...dbEmailConfig }));
        if (dbEmailConfig.user && !testRecipient) {
          setTestRecipient(dbEmailConfig.user);
        }
      }
    }).catch(console.error);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      await api.post('/users', { email, password });
      setMsg('Tạo tài khoản thành công!');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setMsg(err.response?.data?.error?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("Lỗi: Chưa cấu hình VITE_GOOGLE_CLIENT_ID trên hệ thống (Render/Environment). Vui lòng thêm biến môi trường này và build lại ứng dụng.");
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets',
      callback: (response: any) => {
        if (response.access_token) {
          setGoogleToken(response.access_token);
          fetchDriveQuota(response.access_token);
        }
      },
    });
    client.requestAccessToken();
  };

  const fetchDriveQuota = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setDriveInfo(data.storageQuota);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin Google Drive:', error);
    }
  };

  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
              <Input type="text" value={clinicProfile.clinicName} onChange={e => setClinicProfile({...clinicProfile, clinicName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Bác sĩ phụ trách</label>
              <Input type="text" value={clinicProfile.doctorName} onChange={e => setClinicProfile({...clinicProfile, doctorName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Địa chỉ</label>
              <Input type="text" value={clinicProfile.address} onChange={e => setClinicProfile({...clinicProfile, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Hotline</label>
              <Input type="text" value={clinicProfile.phone} onChange={e => setClinicProfile({...clinicProfile, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Giờ làm việc</label>
              <Input type="text" placeholder="VD: 08:00 - 20:00" value={clinicProfile.workingHours} onChange={e => setClinicProfile({...clinicProfile, workingHours: e.target.value})} />
            </div>
            <Button type="submit">Lưu thông tin</Button>
          </form>
        </CardContent>
      </Card>

      {/* User Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Tạo tài khoản Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateUser}>
            {msg && <div className="text-sm text-primary bg-mint p-2 rounded">{msg}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">Mật khẩu</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
            </Button>
          </form>
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

      {/* Google Workspace */}
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>Tích hợp Google Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-muted">
            Kết nối tài khoản Google để lưu trữ file vào Drive và đồng bộ lịch sử đặt hẹn sang Google Sheets.
          </p>
          {!googleToken ? (
            <Button onClick={handleConnectGoogle} variant="outline" className="w-full sm:w-auto">
              Kết nối Google Account
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 text-green-700 rounded text-sm font-medium border border-green-200 flex items-center gap-2">
                <Check className="w-4 h-4" /> Đã kết nối thành công!
              </div>
              
              {driveInfo && (
                <div className="p-4 bg-bg-base border border-border-subtle rounded space-y-2">
                  <h4 className="font-semibold text-sm text-text-main">Dung lượng Google Drive</h4>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full" 
                      style={{ width: `${(parseInt(driveInfo.usage) / parseInt(driveInfo.limit)) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-text-muted flex justify-between">
                    <span>Đã dùng: {formatBytes(driveInfo.usage)}</span>
                    <span>Tổng: {formatBytes(driveInfo.limit)}</span>
                  </p>
                  {(parseInt(driveInfo.usage) / parseInt(driveInfo.limit)) > 0.9 && (
                    <p className="text-xs text-status-cancelled font-medium">⚠️ Cảnh báo: Dung lượng sắp đầy!</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
