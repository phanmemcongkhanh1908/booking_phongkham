const fs = require('fs');

let content = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

const validationLogic = `
  const [fieldErrors, setFieldErrors] = useState({ phone: '', email: '' });

  const validatePhone = (phone) => {
    if (!phone) return true;
    const cleanPhone = phone.replace(/[\\s-]/g, '');
    const phoneRegex = /^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$/;
    return phoneRegex.test(cleanPhone);
  };

  const validateEmail = (email) => {
    if (!email) return true;
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  };

  const handleBlur = (field) => {
    if (field === 'phone' && formData.phone) {
      if (!validatePhone(formData.phone)) {
        setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ' }));
      } else {
        setFieldErrors(prev => ({ ...prev, phone: '' }));
      }
    }
    if (field === 'email' && formData.email) {
      if (!validateEmail(formData.email)) {
        setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      } else {
        setFieldErrors(prev => ({ ...prev, email: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại không hợp lệ' }));
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Email không hợp lệ' }));
      return;
    }

    setSubmitting(true);
    setError('');
`;

content = content.replace("const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setSubmitting(true);\n    setError('');", validationLogic);

// Add onBlur to inputs
content = content.replace(/value=\{formData.phone\}\n                onChange=\{e => setFormData\(\{\.\.\.formData, phone: e.target.value\}\)\}/, "value={formData.phone}\n                onChange={e => setFormData({...formData, phone: e.target.value})}\n                onBlur={() => handleBlur('phone')}");

content = content.replace(/value=\{formData.email\}\n              onChange=\{e => setFormData\(\{\.\.\.formData, email: e.target.value\}\)\}/, "value={formData.email}\n              onChange={e => setFormData({...formData, email: e.target.value})}\n              onBlur={() => handleBlur('email')}");

// Display errors
content = content.replace(/<label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-red-500">\*<\/span><\/label>/, `<div className="flex justify-between items-center"><label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-error">*</span></label>{fieldErrors.phone && <span className="text-xs text-error">{fieldErrors.phone}</span>}</div>`);

content = content.replace(/<label className="text-sm font-semibold text-slate-700 flex items-center gap-2">\s*<Mail className="w-4 h-4 text-slate-400" \/>\s*Email nhận thông báo\s*<\/label>/, `<div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><label className="text-sm font-semibold text-slate-700">Email nhận thông báo</label>{fieldErrors.email && <span className="text-xs text-error ml-2">{fieldErrors.email}</span>}</div>`);

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', content);

