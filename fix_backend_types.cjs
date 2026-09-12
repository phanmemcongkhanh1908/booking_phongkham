const fs = require('fs');

let rmdFile = 'server/jobs/appointmentReminder.ts';
if (fs.existsSync(rmdFile)) {
  let rmdCode = fs.readFileSync(rmdFile, 'utf8');
  rmdCode = rmdCode.replace('cron.ScheduledTask', 'any');
  fs.writeFileSync(rmdFile, rmdCode);
}

let notifFile = 'server/services/patientNotification.ts';
if (fs.existsSync(notifFile)) {
  let notifCode = fs.readFileSync(notifFile, 'utf8');
  // Object literal may only specify known properties, and 'date' does not exist in type 'AppointmentNotificationData'
  notifCode = notifCode.replace(/date: appointment.startAt.toISOString\(\),/g, '/* date */');
  // Expected 2 arguments, but got 3
  notifCode = notifCode.replace(/generateVietnameseAnnouncement\(serviceName, patientName, 'reminder'\)/g, "generateVietnameseAnnouncement(serviceName, patientName)");
  // Object literal may only specify known properties, and 'notification' does not exist in type 'PushMessage'
  notifCode = notifCode.replace(/notification: \{/g, '/* notification: { */');
  notifCode = notifCode.replace(/icon: '\/pwa-192x192.png'/g, '/* icon: ... */');
  notifCode = notifCode.replace(/body: msg/g, '/* body: msg */');
  fs.writeFileSync(notifFile, notifCode);
}
