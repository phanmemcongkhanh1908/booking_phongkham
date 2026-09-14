const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const importStr = `import webpush from 'web-push';
import nodeCron from 'node-cron';`;

const targetStr = `app.post('/api/push/subscribe', (req, res) => {
  const { subscription, phone } = req.body;
  if (!subscription || !phone) {
    return res.status(400).json({ error: 'Subscription and phone required' });
  }
  
  // Store the subscription associated with the phone number
  subscriptions.set(phone, subscription);
  console.log('New push subscription for phone:', phone);
  
  res.status(201).json({ success: true, message: 'Subscribed successfully.' });
});`;

const replaceStr = `import { eq } from 'drizzle-orm';
import { db } from './server/db/index.js';
import { patients, pushSubscriptions } from './server/db/schema.js';

app.post('/api/push/subscribe', async (req, res) => {
  const { subscription, phone } = req.body;
  if (!subscription || !phone) {
    return res.status(400).json({ error: 'Subscription and phone required' });
  }
  
  try {
    // Find patient by phone
    const pts = await db.select().from(patients).where(eq(patients.phone, phone));
    if (pts.length > 0) {
       const patientId = pts[0].id;
       // Save to DB
       await db.insert(pushSubscriptions).values({
          id: Math.random().toString(36).substring(7),
          patientId: patientId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
       });
       console.log('Saved push subscription for patient:', patientId);
    }
    
    // Also save in memory map just in case
    subscriptions.set(phone, subscription);
    res.status(201).json({ success: true, message: 'Subscribed successfully.' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});`;

if (content.includes("app.post('/api/push/subscribe'")) {
    content = content.replace(targetStr, replaceStr);
    fs.writeFileSync('server.ts', content);
}
