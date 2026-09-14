const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Fix VAPID keys in server.ts
content = content.replace(
  /webpush\.setVapidDetails\([\s\S]*?\);/,
  `webpush.setVapidDetails(
    'mailto:support@dentalbooking.com',
    process.env.VAPID_PUBLIC_KEY || 'BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk',
    process.env.VAPID_PRIVATE_KEY || 'Tqn3SBNkFGIiSf6uGoGvpDfZXjH1XDesiM9XA5nTiZU'
  );`
);

// Add the endpoints
const endpoints = `
  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'BH2wGmPIHUUgpjmONKc8TkcxWD5jqIEopilog9Mg9sGdGZxbpwqb5aamouPjJRsy20Jy0a7CGEVUbFyt5De4Lyk' });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const { subscription, phone } = req.body;
    if (!subscription || !phone) {
      return res.status(400).json({ error: 'Subscription and phone required' });
    }
    
    try {
      const { db } = await import('./server/db/index.js');
      const { patients, pushSubscriptions } = await import('./server/db/schema.js');
      const { eq } = await import('drizzle-orm');

      const pts = await db.select().from(patients).where(eq(patients.phone, phone));
      if (pts.length > 0) {
         const patientId = pts[0].id;
         await db.insert(pushSubscriptions).values({
            id: Math.random().toString(36).substring(7),
            patientId: patientId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
         });
      }
      
      res.status(201).json({ success: true, message: 'Subscribed successfully.' });
    } catch(err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
`;

if (!content.includes('/api/push/vapid-key')) {
  content = content.replace('app.get("/api/health"', endpoints + '\n  app.get("/api/health"');
}

fs.writeFileSync('server.ts', content);
