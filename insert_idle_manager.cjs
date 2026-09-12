const fs = require('fs');
const file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('IdleTimeoutManager')) {
  // Import
  code = code.replace(
    "import Analytics from './Analytics';",
    "import Analytics from './Analytics';\nimport IdleTimeoutManager from '../../components/admin/IdleTimeoutManager';"
  );
  
  // Insert inside main layout
  code = code.replace(
    "{/* Floating Toast Message System */}",
    "<IdleTimeoutManager />\n      {/* Floating Toast Message System */}"
  );
  fs.writeFileSync(file, code);
}
