const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/MobileSummaryDrawer.tsx', 'utf8');

code = code.replace(
  'className="lg:hidden w-full bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden mb-4 relative z-20"',
  'className="lg:hidden w-full bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden mb-4 sticky top-[72px] z-40"'
);

fs.writeFileSync('src/pages/public/components/MobileSummaryDrawer.tsx', code);
