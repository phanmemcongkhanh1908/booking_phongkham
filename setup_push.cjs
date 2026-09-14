const webpush = require('web-push');
const fs = require('fs');

// Generate VAPID keys if not present
const envPath = '.env';
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (!envContent.includes('VAPID_PUBLIC_KEY')) {
    const vapidKeys = webpush.generateVAPIDKeys();
    fs.appendFileSync(envPath, `\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`);
    console.log('Generated new VAPID keys.');
} else {
    console.log('VAPID keys already exist.');
}
