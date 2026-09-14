const fs = require('fs');
let content = fs.readFileSync('src/pages/public/Booking.tsx', 'utf8');

// Import PWAInstallButton
if (!content.includes('PWAInstallButton')) {
    content = content.replace("import MobileSummaryDrawer from './components/MobileSummaryDrawer';",
    "import MobileSummaryDrawer from './components/MobileSummaryDrawer';\nimport { PWAInstallButton } from './components/PWAInstallButton';");

    // Add to Header before the login button
    const targetStr = `<Link
              to="/admin/login"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all shadow-2xs"
              title="Cổng Đăng nhập Quản trị viên"
            >
              <ShieldAlert className="w-4 h-4" />
            </Link>`;
    const replacementStr = `<PWAInstallButton />\n            ` + targetStr;
    content = content.replace(targetStr, replacementStr);
    
    fs.writeFileSync('src/pages/public/Booking.tsx', content);
}
