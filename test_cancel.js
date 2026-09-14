fetch('http://127.0.0.1:3000/api/public/appointments/48cf5af9-be0a-47dd-9d39-74f53b465b5f/cancel', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: "0912345678" })
}).then(r => r.json()).then(console.log).catch(console.error);
