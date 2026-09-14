fetch('http://127.0.0.1:3000/api/public/appointments/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: "0912345678", fullName: "Khanh" })
}).then(r => r.json()).then(console.log).catch(console.error);
