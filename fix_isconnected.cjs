const fs = require('fs');
let dbFile = 'src/pages/admin/Dashboard.tsx';
let dbCode = fs.readFileSync(dbFile, 'utf8');

dbCode = dbCode.replace(
  "const { isConnected, connect: connectGoogleStore } = useGoogleAuthStore();",
  ""
);
dbCode = dbCode.replace(
  "const { isConnected, init: initGoogleAuth } = useGoogleAuthStore();",
  "const { isConnected, init: initGoogleAuth, connect: connectGoogleStore } = useGoogleAuthStore();"
);

fs.writeFileSync(dbFile, dbCode);
