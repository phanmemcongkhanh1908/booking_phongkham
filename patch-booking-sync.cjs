const fs = require('fs');
let booking = fs.readFileSync('src/pages/public/Booking.tsx', 'utf8');

booking = booking.replace(
  "  const location = useLocation();",
  `  const location = useLocation();

  // Keep URL in sync with store step
  useEffect(() => {
    if (store.step === 1 && currentPath !== 'dich-vu') navigate('dich-vu');
    else if (store.step === 2 && currentPath !== 'chon-gio') navigate('chon-gio');
    else if (store.step === 3 && currentPath !== 'thong-tin') navigate('thong-tin');
    else if (store.step === 4 && currentPath !== 'hoan-tat') navigate('hoan-tat');
  }, [store.step]);

  // Keep store step in sync with URL
  useEffect(() => {
    if (currentPath === 'dich-vu' && store.step !== 1) store.setStep(1);
    else if (currentPath === 'chon-gio' && store.step !== 2) store.setStep(2);
    else if (currentPath === 'thong-tin' && store.step !== 3) store.setStep(3);
    else if (currentPath === 'hoan-tat' && store.step !== 4) store.setStep(4);
  }, [currentPath]);
`
);

fs.writeFileSync('src/pages/public/Booking.tsx', booking);
