const fs = require('fs');
const path = 'src/pages/admin/Login.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add Remember Me logic and checkbox
if (!content.includes('const [rememberMe')) {
    content = content.replace("const [error, setError] = useState('');", 
`const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);`);
}

if (!content.includes('localStorage.setItem(\'rememberedEmail\'')) {
    content = content.replace("setAuth(res.data.data.token, res.data.data.user);",
`setAuth(res.data.data.token, res.data.data.user);
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberedPassword', password);
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
        }`);
}

if (!content.includes('id="rememberMe"')) {
    const rememberMeJSX = `
            <div className="flex items-center space-x-2 pb-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-teal-600 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-text-muted cursor-pointer select-none">
                Ghi nhớ tài khoản và mật khẩu
              </label>
            </div>
            <Button`;
    content = content.replace("<Button", rememberMeJSX);
}

fs.writeFileSync(path, content);
console.log('Patched Login.tsx');
