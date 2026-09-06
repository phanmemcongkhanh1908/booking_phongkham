const fs = require('fs');
const path = 'src/pages/admin/Patients.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import config from '../../../firebase-applet-config.json';",
  ""
);

content = content.replace(
  "client_id: config.oAuthClientId,",
  "client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',"
);

fs.writeFileSync(path, content);
