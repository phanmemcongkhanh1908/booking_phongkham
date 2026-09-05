import React, { useEffect, useRef, useState } from 'react';
import { useBookingStore } from '../../../store/booking';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CheckCircle, Download, Mail, Send, Bell, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import api from '../../../services/api';

export default function SuccessView() {
  const { 
    reset, 
    appointmentId, 
    patientName, 
    patientPhone, 
    patientEmail, 
    serviceName, 
    slotStartTime,
    telegramBotUsername 
  } = useBookingStore();

  const ticketRef = useRef<HTMLDivElement>(null);
  const [emailInput, setEmailInput] = useState(patientEmail || '');
  const [emailSent, setEmailSent] = useState(Boolean(patientEmail));
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState(patientEmail ? `Email xác nhận đã được lên lịch gửi tới: ${patientEmail}` : '');

  const [telegramLinked, setTelegramLinked] = useState(false);
  const [botUsername, setBotUsername] = useState(telegramBotUsername || '');

  useEffect(() => {
    // Fetch clinic info & telegram bot username if not loaded yet
    if (!botUsername) {
      api.get('/public/clinic-info').then(res => {
        if (res.data.data?.telegramBotUsername) {
          setBotUsername(res.data.data.telegramBotUsername);
        }
      }).catch(console.error);
    }

    // Xin quyền Push Notification nếu PWA được hỗ trợ
    if ('Notification' in window && navigator.serviceWorker) {
      Notification.requestPermission().catch(() => {});
    }
  }, [botUsername]);

  const handleDownloadTicket = async () => {
    if (ticketRef.current) {
      try {
        const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `ticket-${appointmentId || 'booking'}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Error generating ticket image:', err);
      }
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !appointmentId) return;

    setEmailLoading(true);
    setEmailMsg('');
    try {
      const res = await api.post(`/public/appointments/${appointmentId}/notify`, {
        email: emailInput.trim(),
      });
      if (res.data.success) {
        setEmailSent(true);
        setEmailMsg(`Đã gửi thành công email xác nhận lịch khám tới ${emailInput.trim()}!`);
      }
    } catch (err: any) {
      setEmailMsg(err.response?.data?.error?.message || 'Có lỗi khi gửi email. Vui lòng thử lại sau.');
    } finally {
      setEmailLoading(false);
    }
  };

  const telegramLink = botUsername && appointmentId 
    ? `https://t.me/${botUsername}?start=apt_${appointmentId}`
    : 'https://t.me';

  const qrData = JSON.stringify({ type: 'checkin', id: appointmentId });

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-soft max-w-2xl mx-auto">
      <CardContent className="flex flex-col items-center justify-center py-8 px-4 sm:px-8 text-center">
        <div className="mb-3 rounded-full bg-green-100 p-3 text-green-600">
          <CheckCircle size={44} />
        </div>
        <h2 className="mb-1.5 text-2xl font-bold text-text-main">Đặt lịch khám thành công!</h2>
        <p className="mb-6 max-w-md text-sm text-text-muted">
          Hệ thống đã tiếp nhận lịch hẹn của bạn. Thông báo xác nhận và nhắc hẹn sẽ được tự động gửi qua Email và Telegram.
        </p>

        {/* The Ticket */}
        {appointmentId && (
          <div 
            ref={ticketRef} 
            className="mb-6 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md relative"
          >
            <div className="bg-primary px-4 py-3 text-white text-center">
              <h3 className="font-bold text-lg tracking-wide">DENTAL SMART</h3>
              <p className="text-xs opacity-90">Thẻ đặt lịch khám điện tử (E-Ticket)</p>
            </div>
            
            <div className="p-5 text-left border-b border-dashed border-slate-300">
              <div className="mb-3">
                <p className="text-xs text-text-muted uppercase tracking-wider">Khách hàng</p>
                <p className="font-semibold text-text-main text-lg">{patientName}</p>
                <p className="text-sm text-text-muted">{patientPhone}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs text-text-muted uppercase tracking-wider">Dịch vụ</p>
                <p className="font-medium text-text-main">{serviceName}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider">Thời gian</p>
                <p className="font-semibold text-primary">
                  {slotStartTime ? format(new Date(slotStartTime), 'HH:mm - EEEE, dd/MM/yyyy') : 'Chờ xác nhận'}
                </p>
              </div>
            </div>
            
            <div className="p-4 flex flex-col items-center justify-center bg-slate-50 relative">
              <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-white border border-slate-200"></div>
              <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white border border-slate-200"></div>
              
              <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                <QRCodeCanvas value={qrData} size={110} level="M" />
              </div>
              <p className="mt-2 text-[11px] text-text-muted tracking-widest uppercase font-mono">Mã quét Check-in: #{appointmentId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        )}

        {/* Automated Notification Hub (Telegram & Email) */}
        <div className="w-full max-w-md mb-6 space-y-3.5 text-left">
          <div className="p-4 rounded-xl border border-border-subtle bg-slate-50/70 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-primary" />
              Kênh nhận thông báo tự động cho bạn
            </h4>

            {/* Email Notification Channel */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-primary">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-main">Thông báo qua Email</p>
                    <p className="text-[11px] text-text-muted">Nhận chi tiết lịch hẹn & thư xác nhận</p>
                  </div>
                </div>
                {emailSent && (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Đã kết nối
                  </span>
                )}
              </div>

              {emailMsg && (
                <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100">
                  {emailMsg}
                </p>
              )}

              <form onSubmit={handleSendEmail} className="flex gap-2">
                <Input 
                  type="email" 
                  placeholder="Nhập email của bạn..." 
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="text-xs h-9"
                  required
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  variant="outline"
                  disabled={emailLoading || !emailInput}
                  className="shrink-0 text-xs h-9 border-primary text-primary hover:bg-primary/5"
                >
                  {emailLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (emailSent ? 'Gửi lại' : 'Gửi Email')}
                </Button>
              </form>
            </div>

            {/* Telegram Notification Channel */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-main">Thông báo qua Telegram</p>
                    <p className="text-[11px] text-text-muted">Nhận tin nhắn tức thì khi lịch được duyệt hoặc nhắc giờ</p>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <a
                  href={telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTelegramLinked(true)}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-white bg-[#229ED9] hover:bg-[#1E88E5] rounded-lg transition shadow-2xs text-decoration-none"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{telegramLinked ? "Mở Telegram kiểm tra tin nhắn" : "Bấm vào đây để nhận thông báo Telegram"}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <p className="mt-1.5 text-[11px] text-text-muted text-center">
                  💡 Nhấn vào link sẽ tự động kích hoạt Bot thông báo riêng cho lịch hẹn của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full max-w-sm flex-col sm:flex-row gap-2.5">
          {appointmentId && (
            <Button onClick={handleDownloadTicket} variant="outline" className="flex-1 text-xs">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Tải vé ảnh về máy
            </Button>
          )}
          <Button onClick={reset} className="flex-1 bg-primary text-white text-xs">
            Về trang chủ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
