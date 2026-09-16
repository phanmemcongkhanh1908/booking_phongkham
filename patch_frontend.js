import fs from 'fs';
let file = 'src/pages/public/components/PatientForm.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add imports
const importTarget = `import { CalendarDays, Clock, MapPin, Search, ChevronRight, ShieldCheck, Camera, Sparkles, Loader2, CheckCircle, Info } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';`;

const importReplace = `import { CalendarDays, Clock, MapPin, Search, ChevronRight, ShieldCheck, Camera, Sparkles, Loader2, CheckCircle, Info } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { auth } from '../../../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';`;

code = code.replace(importTarget, importReplace);

// Add confirmationResult ref
const refTarget = `  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);`;

const refReplace = `  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);`;

code = code.replace(refTarget, refReplace);

// Update handlers
const handlersTarget = `  const handleSendOtp = async () => {
    try {
      const res = await api.post('/public/patients/send-otp', { phone: formData.phone });
      if (res.data?.success) {
        setOtpSent(true);
        toast.success(\`Mã OTP đã gửi (Mã Test: \${res.data.devOtp})\`, { duration: 5000 });
      }
    } catch (err) {
      toast.error("Không thể gửi OTP.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error("Vui lòng nhập mã OTP.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await api.post('/public/patients/verify', {
        phone: formData.phone,
        otp: otpCode
      });
      if (res.data?.success && res.data?.match && res.data?.data) {
        const p = res.data.data;
        updateField('fullName', p.fullName || formData.fullName);
        updateField('email', p.email || formData.email);
        updateField('notes', p.notes || formData.notes);
        
        setPhoneStatus('verified');
        toast.success("Xác thực thành công! Đã tự động điền thông tin.");
      } else {
        toast.error(res.data?.error || "Mã OTP không chính xác.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xác thực.");
    } finally {
      setIsVerifying(false);
    }
  };`;

const handlersReplace = `  const handleSendOtp = async () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': () => {
            // reCAPTCHA solved
          }
        });
      }

      // Format phone number to international format (e.g. +84...)
      let phoneNum = String(formData.phone).trim().replace(/\\D/g, "");
      if (phoneNum.startsWith('0')) {
        phoneNum = '+84' + phoneNum.slice(1);
      } else if (phoneNum.startsWith('84')) {
        phoneNum = '+' + phoneNum;
      } else if (!phoneNum.startsWith('+')) {
        phoneNum = '+84' + phoneNum;
      }

      const toastId = toast.loading("Đang gửi mã OTP...");
      const confirmation = await signInWithPhoneNumber(auth, phoneNum, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      toast.success("Mã OTP đã được gửi đến số điện thoại của bạn.", { id: toastId });
    } catch (err: any) {
      console.error("Firebase send OTP error:", err);
      // Reset recaptcha on error so user can try again
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      if (err.code === 'auth/invalid-phone-number') {
         toast.error("Số điện thoại không hợp lệ.");
      } else if (err.code === 'auth/too-many-requests') {
         toast.error("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
      } else {
         toast.error("Không thể gửi OTP. Vui lòng thử lại.");
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error("Vui lòng nhập mã OTP.");
      return;
    }
    if (!confirmationResult) {
      toast.error("Phiên xác thực đã hết hạn, vui lòng gửi lại mã.");
      return;
    }
    setIsVerifying(true);
    try {
      const result = await confirmationResult.confirm(otpCode);
      const user = result.user;
      const idToken = await user.getIdToken();
      
      const res = await api.post('/public/patients/verify', {
        phone: formData.phone,
        firebaseToken: idToken
      });
      
      if (res.data?.success && res.data?.match && res.data?.data) {
        const p = res.data.data;
        updateField('fullName', p.fullName || formData.fullName);
        updateField('email', p.email || formData.email);
        updateField('notes', p.notes || formData.notes);
        
        setPhoneStatus('verified');
        toast.success("Xác thực thành công! Đã tự động điền thông tin.");
      } else {
        // If phone verified but patient not matched... wait, we check phone existence before showing verify UI.
        // It should match. If not, we just treat as new but phone verified.
        setPhoneStatus('new');
        toast.success("Đã xác thực số điện thoại thành công.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        toast.error("Mã OTP không chính xác.");
      } else if (err.code === 'auth/code-expired') {
        toast.error("Mã OTP đã hết hạn.");
      } else {
        toast.error(err.response?.data?.error || "Có lỗi xảy ra khi xác thực.");
      }
    } finally {
      setIsVerifying(false);
    }
  };`;

code = code.replace(handlersTarget, handlersReplace);

// Add recaptcha-container right before the phone input section or at the end of the form.
const renderTarget = `              {/* Khối xác thực nếu là khách cũ */}
              {phoneStatus === 'existing_unverified' && (`;

const renderReplace = `              <div id="recaptcha-container"></div>
              {/* Khối xác thực nếu là khách cũ */}
              {phoneStatus === 'existing_unverified' && (`;

code = code.replace(renderTarget, renderReplace);

fs.writeFileSync(file, code);
