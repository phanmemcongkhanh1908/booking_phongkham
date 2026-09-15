const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

const typeErrorStr = `export default function SuccessView() {
  const { 
    reset, 
    appointmentId, 
    patientName, 
    patientPhone, 
    patientEmail, 
    serviceName, 
    serviceDuration,
    slotStartTime, 
    providerName,
    clinicProfile,
    telegramBotUsername,
    bookingFormConfig
  } = useBookingStore();`;

// The store might not have typed `bookingFormConfig` with `preVisitNotes` properly. We can cast it or any.
const fixTypeStr = `export default function SuccessView() {
  const store = useBookingStore();
  const { 
    reset, 
    appointmentId, 
    patientName, 
    patientPhone, 
    patientEmail, 
    serviceName, 
    serviceDuration,
    slotStartTime, 
    providerName,
    clinicProfile,
    telegramBotUsername,
  } = store;
  const bookingFormConfig: any = store.bookingFormConfig;`;

code = code.replace(typeErrorStr, fixTypeStr);

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', code);
console.log('SuccessView TS patched');
