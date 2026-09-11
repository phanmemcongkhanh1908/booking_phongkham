const fs = require('fs');
const path = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the md:hidden horizontal scroll menu in the header
const mobileMenuRegex = /<div className="md:hidden relative border-t border-slate-200\/60 bg-slate-50\/70">[\s\S]*?<\/div>\s*<\/header>/;
if (mobileMenuRegex.test(content)) {
    content = content.replace(mobileMenuRegex, '</header>');
    console.log('Removed horizontal mobile menu');
}

// 2. Add padding to main for mobile
const mainRegex = /<main className="flex-1 p-3\.5 sm:p-6 max-w-7xl mx-auto w-full relative">/;
if (mainRegex.test(content)) {
    content = content.replace(mainRegex, '<main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 max-w-7xl mx-auto w-full relative">');
    console.log('Added pb-24 to main');
}

// 3. Add Bottom Navigation before the end of the main div
const bottomNav = `
      {/* Mobile Bottom Navigation (Persistent, replacing horizontal scroll) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around px-2 h-16">
          {hasPermission('appointment.view') && (
            <button 
              onClick={() => setActiveTab('appointments')}
              className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors \${activeTab === 'appointments' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}\`}
            >
              <Calendar className={\`w-5 h-5 \${activeTab === 'appointments' ? 'fill-primary/20' : ''}\`} />
              <span className="text-[10px] font-semibold">Lịch hẹn</span>
            </button>
          )}
          {hasPermission('patient.view') && (
            <button 
              onClick={() => setActiveTab('patients')}
              className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors \${activeTab === 'patients' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}\`}
            >
              <Users className={\`w-5 h-5 \${activeTab === 'patients' ? 'fill-primary/20' : ''}\`} />
              <span className="text-[10px] font-semibold">Bệnh án</span>
            </button>
          )}
          {hasPermission('service.manage') && (
            <button 
              onClick={() => setActiveTab('services')}
              className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors \${activeTab === 'services' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}\`}
            >
              <LayoutList className={\`w-5 h-5 \${activeTab === 'services' ? 'fill-primary/20' : ''}\`} />
              <span className="text-[10px] font-semibold">Dịch vụ</span>
            </button>
          )}
          {hasPermission('analytics.view') && (
            <button 
              onClick={() => setActiveTab('analytics')}
              className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors \${activeTab === 'analytics' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}\`}
            >
              <BarChart3 className={\`w-5 h-5 \${activeTab === 'analytics' ? 'fill-primary/20' : ''}\`} />
              <span className="text-[10px] font-semibold">Thống kê</span>
            </button>
          )}
          {hasPermission('setting.manage') && (
            <button 
              onClick={() => setActiveTab('settings')}
              className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors \${activeTab === 'settings' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}\`}
            >
              <SettingsIcon className={\`w-5 h-5 \${activeTab === 'settings' ? 'fill-primary/20' : ''}\`} />
              <span className="text-[10px] font-semibold">Cài đặt</span>
            </button>
          )}
        </div>
      </nav>

      {/* Floating Toast Message System */}
`;

content = content.replace(/\{\/\* Floating Toast Message System[^\n]*\n/, bottomNav);
console.log('Added bottom nav');

fs.writeFileSync(path, content);
