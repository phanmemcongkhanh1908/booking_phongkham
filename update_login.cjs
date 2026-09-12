const fs = require('fs');
const file = 'src/pages/admin/Login.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace default state
code = code.replace(
  "const [email, setEmail] = useState('admin@dentalsmartbooking.com');",
  "const [email, setEmail] = useState('');"
);
code = code.replace(
  "const [password, setPassword] = useState('admin@123');",
  "const [password, setPassword] = useState('');"
);

// Replace useEffect
const oldUseEffect = `  React.useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);`;

const newUseEffect = `  React.useEffect(() => {
    const lastEmail = localStorage.getItem('lastEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const wasRemembered = localStorage.getItem('rememberMeChecked') === 'true';

    if (lastEmail) setEmail(lastEmail);
    if (wasRemembered && savedPassword) {
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);`;

code = code.replace(oldUseEffect, newUseEffect);

// Replace handleLogin
const oldHandleLoginStorage = `        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberedPassword', password);
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
        }`;

const newHandleLoginStorage = `        localStorage.setItem('lastEmail', email);
        if (rememberMe) {
          localStorage.setItem('rememberedPassword', password);
          localStorage.setItem('rememberMeChecked', 'true');
        } else {
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberMeChecked');
        }`;

code = code.replace(oldHandleLoginStorage, newHandleLoginStorage);

fs.writeFileSync(file, code);
