import React, { useState, useEffect } from 'react';
import { BellRing, Check, Bell, AlertTriangle, ExternalLink, ShieldAlert, X, HelpCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

interface Props {
  phone: string;
}

export const PushNotificationPrompt: React.FC<Props> = ({ phone }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unknown'>('unknown');
  const [isInIframe, setIsInIframe] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    // Check if running inside iframe
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          if (sub) setIsSubscribed(true);
        });
      }).catch(() => {
        // service worker not registered or ready
      });
    }
  }, []);

  const openInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const subscribeToPush = async () => {
    // 1. If currently in iframe and permission is not granted yet, browser security blocks requestPermission
    if (isInIframe && permissionState !== 'granted') {
      setShowHelpModal(true);
      toast((t) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800">Trình duyệt chặn thông báo trong khung iFrame!</p>
          <p className="text-slate-600 mt-1">Vui lòng mở ứng dụng ở Tab mới để cấp quyền.</p>
        </div>
      ), { icon: 'ℹ️', duration: 5000 });
      return;
    }

    // 2. If permission is already denied in browser
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setShowHelpModal(true);
      return;
    }

    try {
      setLoading(true);

      let permission: NotificationPermission = 'default';
      try {
        permission = await Notification.requestPermission();
        setPermissionState(permission);
      } catch (permErr) {
        console.warn('Notification.requestPermission error (likely iframe restriction):', permErr);
        setShowHelpModal(true);
        setLoading(false);
        return;
      }

      if (permission !== 'granted') {
        setPermissionState(permission);
        setShowHelpModal(true);
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const vapidRes = await api.get('/push/vapid-key');
      const publicKey = vapidRes.data.publicKey;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send to server
      await api.post('/push/subscribe', {
        subscription,
        phone
      });

      setIsSubscribed(true);
      toast.success('Đã bật nhận thông báo nhắc lịch tự động!', { icon: '🔔' });
    } catch (err: any) {
      console.error('Lỗi khi đăng ký Push Notification:', err);
      // If error mentions iframe or permission
      if (String(err?.message || '').toLowerCase().includes('iframe') || Notification.permission === 'denied') {
        setShowHelpModal(true);
      } else {
        toast.error('Không thể đăng ký nhận thông báo lúc này. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!phone) {
      toast.error('Vui lòng cung cấp số điện thoại');
      return;
    }
    setTestLoading(true);
    try {
      const res = await api.post('/push/test', { phone });
      if (res.data.success) {
        toast.success('Đã gửi thông báo thử nghiệm! Vui lòng kiểm tra thanh thông báo.', { icon: '🔔' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể gửi thông báo thử nghiệm');
    } finally {
      setTestLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <>
      <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-blue-900">Thông báo nhắc hẹn</h4>
              {permissionState === 'denied' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  Đang bị chặn bởi trình duyệt
                </span>
              )}
            </div>
            <p className="text-xs text-blue-700 mt-0.5">
              {isSubscribed 
                ? 'Thiết bị này sẽ nhận thông báo đẩy trước giờ khám & khi đổi trạng thái.' 
                : 'Bật thông báo để không quên lịch hẹn của bạn.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {permissionState === 'denied' ? (
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" /> Cách bật lại quyền
            </button>
          ) : !isSubscribed ? (
            <button
              type="button"
              onClick={subscribeToPush}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {loading ? 'Đang bật...' : (
                <>
                  <BellRing className="w-4 h-4" /> Bật ngay
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="shrink-0 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Đã bật
              </div>
              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={testLoading}
                className="shrink-0 px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Gửi thử một thông báo đẩy đến thiết bị này"
              >
                <RefreshCw className={`w-3 h-3 ${testLoading ? 'animate-spin text-blue-600' : ''}`} />
                Thử thông báo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL HƯỚNG DẪN MỞ KHÓA QUYỀN THÔNG BÁO */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Tại sao báo bị từ chối?</h3>
                  <p className="text-xs text-slate-500">Giải thích và hướng dẫn mở quyền thông báo</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-600">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="font-semibold text-amber-900 mb-1">🔍 Nguyên nhân chính:</p>
                <ul className="list-disc pl-4 space-y-1 text-amber-800">
                  {isInIframe ? (
                    <li>
                      <strong>Bạn đang mở web trong khung iFrame (Live Preview)</strong>: Theo chính sách bảo mật của Google Chrome và Safari, các trang web nằm trong khung nhúng (iFrame) bị <em>ngăn chặn tuyệt đối</em> việc xin quyền gửi thông báo đẩy để chống spam.
                    </li>
                  ) : null}
                  <li>
                    <strong>Cài đặt trình duyệt đang đặt "Chặn" (Block)</strong>: Trình duyệt của bạn đang lưu trạng thái từ chối cho địa chỉ web này. Khi đã bị Chặn, trình duyệt <em>sẽ không hỏi lại hộp thoại cấp quyền nữa</em> mà tự động từ chối.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-sm">💡 Cách xử lý nhanh nhất:</p>

                {isInIframe && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="font-semibold text-blue-900 mb-1">Cách 1: Mở ứng dụng ở Tab mới (Khuyên dùng)</p>
                    <p className="text-blue-700 mb-2">
                      Khi mở ở Tab độc lập ngoài khung iFrame, trình duyệt sẽ cho phép hiển thị hộp thoại xin cấp quyền thông báo.
                    </p>
                    <button
                      type="button"
                      onClick={openInNewTab}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" /> Mở trang này ở Tab mới
                    </button>
                  </div>
                )}

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="font-semibold text-slate-800 mb-1.5">Cách 2: Mở khóa quyền trên thanh địa chỉ URL</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                    <li>Nhìn lên thanh địa chỉ trình duyệt, bấm vào biểu tượng <strong>Ổ khóa 🔒</strong> hoặc <strong>Cài đặt trang web</strong> (cạnh đường dẫn <code>https://...</code>).</li>
                    <li>Tìm mục <strong>Thông báo (Notifications)</strong>.</li>
                    <li>Đổi từ <strong>Chặn (Block)</strong> sang <strong>Cho phép (Allow)</strong> hoặc bấm <strong>Đặt lại quyền</strong>.</li>
                    <li>Nhấn F5 để tải lại trang rồi bấm lại nút <strong>"Bật ngay"</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowHelpModal(false);
                  if (typeof Notification !== 'undefined') {
                    setPermissionState(Notification.permission);
                  }
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

