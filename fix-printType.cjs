const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

const stateToAdd = `
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const recordRef = React.useRef<HTMLDivElement>(null);
  const [printType, setPrintType] = useState<'receipt' | 'record' | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState<'receipt' | 'record' | null>(null);
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState('');

  // Handle printing by hiding other elements
  useEffect(() => {
    if (printType) {
      setTimeout(() => {
        window.print();
        setPrintType(null);
      }, 500);
    }
  }, [printType]);

  const handleSendTelegram = async () => {
    if (!telegramIdInput.trim()) {
      alert("Vui lòng nhập Username hoặc Chat ID Telegram");
      return;
    }
    
    setSendingTelegram(true);
    setTelegramSuccess('');
    
    try {
      const targetRef = showTelegramModal === 'receipt' ? receiptRef : recordRef;
      if (!targetRef.current) return;
      
      // We temporarily show it to capture it, html2canvas needs it to be in DOM (not display: none)
      targetRef.current.style.left = '0';
      targetRef.current.style.top = '0';
      targetRef.current.style.zIndex = '-100';
      
      const canvas = await html2canvas(targetRef.current, { scale: 2 });
      const base64Data = canvas.toDataURL('image/png');
      
      targetRef.current.style.left = '-9999px';
      targetRef.current.style.top = '-9999px';

      const res = await api.post(\`/patients/\${selectedPatient?.id}/send-document\`, {
        telegramId: telegramIdInput,
        base64Data,
        filename: showTelegramModal === 'receipt' ? 'Phieu_Thu.png' : 'Ho_So_Benh_An.png',
        caption: showTelegramModal === 'receipt' ? \`Phiếu thu của bệnh nhân \${selectedPatient?.fullName}\` : \`Hồ sơ bệnh án của bệnh nhân \${selectedPatient?.fullName}\`
      });

      if (res.data.success) {
        setTelegramSuccess('Gửi thành công qua Telegram!');
        // Update local patient state to reflect new Telegram ID
        if (selectedPatient) {
          setSelectedPatient({...selectedPatient, telegramId: telegramIdInput});
          setPatients(patients.map(p => p.id === selectedPatient.id ? {...p, telegramId: telegramIdInput} : p));
        }
        
        setTimeout(() => {
          setShowTelegramModal(null);
          setTelegramSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error?.message || "Có lỗi khi gửi Telegram.");
    } finally {
      setSendingTelegram(false);
    }
  };
`;

if (!content.includes("const [printType")) {
  content = content.replace("const [previewRotation, setPreviewRotation] = useState<number>(0);", "const [previewRotation, setPreviewRotation] = useState<number>(0);\n" + stateToAdd);
  fs.writeFileSync('src/pages/admin/Patients.tsx', content);
  console.log("Fixed!");
} else {
  console.log("Already fixed");
}
