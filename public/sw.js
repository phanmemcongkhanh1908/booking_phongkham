// Service Worker for Dental Smart Booking Web Push Notifications
const CACHE_NAME = 'dental-smart-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push Notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Dental Smart Booking',
    body: 'Bạn có một cập nhật mới về lịch hẹn.',
    url: '/lich-hen-cua-toi',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'dental-smart-appointment',
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'dental-smart-appointment',
    renotify: true,
    data: {
      url: data.url || '/lich-hen-cua-toi',
      appointmentId: data.appointmentId || null,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view-appointment',
        title: 'Xem lịch hẹn'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/lich-hen-cua-toi';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open with the app, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
