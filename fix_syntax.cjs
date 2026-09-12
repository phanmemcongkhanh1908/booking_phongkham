const fs = require('fs');

let notifFile = 'server/services/patientNotification.ts';
let notifCode = fs.readFileSync(notifFile, 'utf8');

notifCode = notifCode.replace(
`      await sendWebPush(apt.patientId, {
        /* notification: { */
          title: pushTitle,
          body: pushBody,
          icon: "/icon-192x192.png",
        }
      });`,
`      await sendWebPush(apt.patientId, {
        title: pushTitle,
        body: pushBody,
        icon: "/icon-192x192.png",
      } as any);`
);
fs.writeFileSync(notifFile, notifCode);
