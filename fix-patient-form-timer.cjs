const fs = require('fs');

let content = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

const replacement = `
  const { sessionToken, slotStartTime, setStep, holdExpiresAt } = useBookingStore();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    telegramId: '',
    notes: ''
  });

  const calculateTimeLeft = () => {
    if (!holdExpiresAt) return 0;
    const now = Date.now();
    return Math.max(0, Math.floor((holdExpiresAt - now) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedNotify, setShowAdvancedNotify] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        alert("Đã hết thời gian giữ chỗ. Vui lòng chọn lại ngày giờ.");
        setStep(2);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) updateTimer();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [holdExpiresAt, setStep]);
`;

// use string slice or regex to replace the state block
content = content.replace(
  /const { sessionToken, slotStartTime, setStep } = useBookingStore\(\);[\s\S]*?const isWarning = timeLeft <= 60;/m,
  replacement + "\n  const minutes = Math.floor(timeLeft / 60);\n  const seconds = timeLeft % 60;\n  const isWarning = timeLeft <= 60;"
);

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', content);

