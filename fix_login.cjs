const fs = require('fs');
const path = 'src/pages/admin/Login.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "const [email, setEmail] = useState('');",
  "const [email, setEmail] = useState('admin@dentalsmartbooking.com');"
);
content = content.replace(
  "const [password, setPassword] = useState('');",
  "const [password, setPassword] = useState('admin@123');"
);

fs.writeFileSync(path, content);
