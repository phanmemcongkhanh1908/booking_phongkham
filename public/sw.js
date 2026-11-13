// Service Worker for Dental Smart Booking & Clinic Admin Mobile Notifications
const CACHE_NAME = 'dental-smart-static-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push Notifications (Patient & Clinic Admin)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Dental Smart Booking',
    body: 'Bạn có một cập nhật mới về lịch hẹn.',
    url: '/lich-hen-cua-toi',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'dental-smart-appointment',
    type: 'patient_update',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    appointmentId: null,
    tenantId: null,
    patientName: '',
    patientPhone: '',
    serviceName: '',
    providerName: '',
    startAt: '',
    status: 'REQUESTED',
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const isAdminBooking = data.type === 'admin_booking' || data.type === 'admin_test';

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: Array.isArray(data.vibrate)
      ? data.vibrate
      : isAdminBooking
      ? [250, 100, 250, 100, 250]
      : [200, 100, 200],
    tag: data.tag || (data.appointmentId ? `apt-${data.appointmentId}` : 'dental-smart-appointment'),
    renotify: true,
    requireInteraction: isAdminBooking || Boolean(data.requireInteraction),
    data: {
      url: data.url || (isAdminBooking ? '/admin/dashboard' : '/lich-hen-cua-toi'),
      appointmentId: data.appointmentId || null,
      type: data.type,
      tenantId: data.tenantId || null,
      timestamp: Date.now(),
    },
    actions: isAdminBooking
      ? [
          {
            action: 'open-popup',
            title: 'Xem & Chốt lịch',
          },
          {
            action: 'dismiss',
            title: 'Đóng',
          },
        ]
      : [
          {
            action: 'view-appointment',
            title: 'Xem lịch hẹn',
          },
        ],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, notificationOptions);

      // If Admin app/PWA is currently open in foreground or suspended tab, notify it immediately
      if (isAdminBooking) {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          if (client.url && client.url.includes('/admin')) {
            try {
              client.postMessage({
                type: 'SW_PUSH_BOOKING',
                payload: data,
              });
            } catch {}
          }
        }
      }
    })()
  );
});

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/lich-hen-cua-toi';
  const appointmentId = notifData.appointmentId || null;
  const isAdmin = notifData.type === 'admin_booking' || notifData.type === 'admin_test' || String(targetUrl).includes('/admin');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // Prefer focusing an existing Admin window when clicking an Admin notification
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const matchesContext = isAdmin ? client.url.includes('/admin') : !client.url.includes('/admin');
        if (client.url && matchesContext && 'focus' in client) {
          try {
            client.postMessage({
              type: 'OPEN_BOOKING_POPUP',
              appointmentId,
              url: targetUrl,
            });
          } catch {}
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
