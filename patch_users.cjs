const fs = require('fs');
const path = 'src/pages/admin/UsersManagement.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update PERMISSION_MATRIX
const newMatrix = `const PERMISSION_MATRIX = [
  {
    module: 'Quản trị hệ thống (Root)',
    permissions: [
      { id: '*', label: 'Toàn quyền (Super Admin)' },
    ]
  },
  {
    module: 'Lễ tân & CSKH',
    permissions: [
      { id: 'appointment.view', label: 'Xem lịch hẹn' },
      { id: 'appointment.create', label: 'Thêm/Sửa lịch' },
      { id: 'appointment.update', label: 'Xóa lịch hẹn' },
      { id: 'patient.view', label: 'Xem/Thêm hồ sơ bệnh nhân' },
    ]
  },
  {
    module: 'Bác sĩ & Lâm sàng',
    permissions: [
      { id: 'clinical.view', label: 'Xem hồ sơ bệnh án' },
      { id: 'clinical.edit', label: 'Chỉnh sửa/Cập nhật bệnh án' },
      { id: 'xray.view', label: 'Xem phim X-Quang' },
    ]
  },
  {
    module: 'Quản lý phòng khám',
    permissions: [
      { id: 'service.manage', label: 'Quản lý dịch vụ' },
      { id: 'analytics.view', label: 'Xem báo cáo doanh thu' },
      { id: 'user.create', label: 'Quản lý nhân sự' },
      { id: 'setting.manage', label: 'Cấu hình hệ thống' },
    ]
  }
];`;

content = content.replace(/const PERMISSION_MATRIX = \[\s*\{[\s\S]*?\}\s*\];/, newMatrix);

// Add state for showing passwords
if (!content.includes('const [showPassword, setShowPassword]')) {
    content = content.replace("const [password, setPassword] = useState('');", 
`const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);`);
}

// Reset state in handleCloseModal
content = content.replace("setPassword('');", "setPassword('');\n    setConfirmPassword('');\n    setShowPassword(false);\n    setShowConfirmPassword(false);");

// Form validation for confirm password
const submitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);/;
content = content.replace(submitRegex, 
`const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'create' && password !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp!');
      return;
    }
    if (modalMode === 'edit' && password && password !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp!');
      return;
    }`);

// Update password input field to include Eye icons and Confirm Password field
const passwordHTML = `<div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {modalMode === 'edit' ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Tối thiểu 6 ký tự" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required={modalMode === 'create'}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(modalMode === 'create' || (modalMode === 'edit' && password.length > 0)) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Xác nhận lại mật khẩu
                  </label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="Nhập lại mật khẩu ở trên" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      required={modalMode === 'create' || password.length > 0}
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}`;

const oldPasswordRegex = /<div className="space-y-2">\s*<label className="text-sm font-medium text-slate-700">\s*\{modalMode === 'edit' \? 'Mật khẩu mới \(Bỏ trống nếu không đổi\)' : 'Mật khẩu'\}\s*<\/label>\s*<input\s*type="text"[\s\S]*?<\/div>/;

content = content.replace(oldPasswordRegex, passwordHTML);

// Ensure Eye and EyeOff are imported
if (!content.includes('EyeOff')) {
  content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, Eye, EyeOff } from 'lucide-react';");
}

fs.writeFileSync(path, content);
console.log('Patched UsersManagement.tsx');
