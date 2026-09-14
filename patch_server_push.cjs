const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const importWebPush = `import webpush from 'web-push';
import nodeCron from 'node-cron';`;
if (!content.includes('import webpush')) {
    content = content.replace("import express", importWebPush + "\nimport express");
}

const setupWebPush = `
// Setup Web Push
webpush.setVapidDetails(
  'mailto:support@dentalbooking.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// Store subscriptions mapped to phone numbers or appointment IDs
const subscriptions = new Map<string, any>();
`;

if (!content.includes('webpush.setVapidDetails')) {
    content = content.replace("const app = express();", setupWebPush + "\nconst app = express();");
}

const pushEndpoints = `
// Subscribe to push notifications
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, phone } = req.body;
  if (!subscription || !phone) {
    return res.status(400).json({ error: 'Subscription and phone required' });
  }
  
  // Store the subscription associated with the phone number
  subscriptions.set(phone, subscription);
  console.log('New push subscription for phone:', phone);
  
  res.status(201).json({ success: true, message: 'Subscribed successfully.' });
});

// Admin triggers test notification to a specific appointment/customer
app.post('/api/push/test', async (req, res) => {
  const { phone, message, title } = req.body;
  
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  
  const sub = subscriptions.get(phone);
  if (!sub) {
    return res.status(404).json({ error: 'Khách hàng chưa đăng ký nhận thông báo (Không tìm thấy Subscription trên thiết bị này).' });
  }
  
  try {
    await webpush.sendNotification(sub, JSON.stringify({
      title: title || 'Nhắc Hẹn Tự Động',
      body: message || 'Bạn có lịch hẹn sắp tới tại phòng khám Nha Khoa.',
      icon: '/pwa-192x192.png',
      data: { url: '/lich-hen-cua-toi' }
    }));
    res.json({ success: true, message: 'Đã gửi thông báo thành công đến thiết bị khách hàng.' });
  } catch (error: any) {
    console.error('Push notification error:', error);
    if (error.statusCode === 410) {
      subscriptions.delete(phone);
    }
    res.status(500).json({ error: 'Failed to send push notification.' });
  }
});

// VAPID Public Key endpoint for client
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});
`;

if (!content.includes('/api/push/subscribe')) {
    content = content.replace("app.post('/api/auth/login", pushEndpoints + "\napp.post('/api/auth/login");
}

fs.writeFileSync('server.ts', content);
