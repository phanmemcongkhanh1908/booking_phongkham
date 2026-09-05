const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// The block to replace:
/*
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const recordRef = React.useRef<HTMLDivElement>(null);
  const [printType, setPrintType] = useState<'receipt' | 'record' | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState<'receipt' | 'record' | null>(null);
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState('');
  const [telegramFormat, setTelegramFormat] = useState<'png' | 'pdf'>('png');

  // Handle printing by hiding other elements
  useEffect(() => {
    if (printType) {
      setTimeout(() => {
        window.print();
        setPrintType(null);
      }, 500);
    }
  }, [printType]);

  const handleSendTelegram = async () => { ... }
*/

// Let's use regex to replace everything from `const receiptRef` to the end of `handleSendTelegram`.
const startIndex = content.indexOf("const receiptRef = React.useRef<HTMLDivElement>(null);");
const handleSendStr = "const handleSendTelegram = async () => {";
const handleSendIndex = content.indexOf(handleSendStr);
// find the end of handleSendTelegram
const endOfHandleSendStr = "    }\n  };\n";
const endOfHandleSendIndex = content.indexOf(endOfHandleSendStr, handleSendIndex) + endOfHandleSendStr.length;

if (startIndex !== -1 && handleSendIndex !== -1 && endOfHandleSendIndex !== -1) {
  const partToReplace = content.substring(startIndex, endOfHandleSendIndex);
  
  const newPart = "const [documentViewerState, setDocumentViewerState] = useState<{isOpen: boolean, type: 'receipt' | 'record' | null}>({isOpen: false, type: null});\n";
  
  content = content.replace(partToReplace, newPart);
  fs.writeFileSync('src/pages/admin/Patients.tsx', content);
  console.log("Successfully replaced block.");
} else {
  console.log("Failed to find boundaries.");
}
