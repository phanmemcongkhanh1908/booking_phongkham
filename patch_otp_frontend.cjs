const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

// The state verifyName is currently used. Let's rename it or replace the UI logic.
// We'll replace `verifyName` with `otpCode` and add `otpSent` state.
code = code.replace(
  `const [verifyName, setVerifyName] = useState('');`,
  `const [otpCode, setOtpCode] = useState('');\n  const [otpSent, setOtpSent] = useState(false);`
);

// We need to replace `handleVerifyName` with `handleSendOtp` and `handleVerifyOtp`.
const verifyFnTarget = `  const handleVerifyName = async () => {
    if (!verifyName.trim()) {
      toast.error("Vui lòng nhập họ tên để xác thực.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await api.post('/public/patients/verify', {
        phone: formData.phone,
        fullName: verifyName
      });
      if (res.data?.success && res.data?.match && res.data?.data) {
        const p = res.data.data;
        updateField('fullName', p.fullName || formData.fullName);
        updateField('email', p.email || formData.email);
        updateField('notes', p.notes || formData.notes);
        
        setPhoneStatus('verified');
        toast.success("Xác thực thành công! Đã tự động điền thông tin của bạn.");
      } else {
        toast.error("Tên không khớp với hồ sơ, vui lòng thử lại hoặc dùng số điện thoại khác.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xác thực.");
    } finally {
      setIsVerifying(false);
    }
  };`;

const verifyFnReplace = `  const handleSendOtp = async () => {
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

code = code.replace(verifyFnTarget, verifyFnReplace);

// Now update the UI where it asks for Name to verify.
const uiTarget = `                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Nhập họ tên của bạn..."
                      value={verifyName}
                      onChange={e => setVerifyName(e.target.value)}
                      className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyName}
                      disabled={isVerifying}
                      className="px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[100px]"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác thực'}
                    </button>
                  </div>`;

const uiReplace = `                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="w-full px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Gửi mã OTP (Zalo/SMS)
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Nhập mã OTP..."
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                        className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-center tracking-widest font-mono"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifying}
                        className="px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[100px]"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác thực'}
                      </button>
                    </div>
                  )}`;

code = code.replace(uiTarget, uiReplace);

// Remove "Nhập đúng họ tên" from UI text:
code = code.replace('Vui lòng nhập đúng họ tên khớp với hồ sơ cũ để bảo mật y tế.', 'Vui lòng xác thực mã OTP để bảo vệ dữ liệu y tế của bạn.');

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', code);
console.log('OTP frontend added.');
