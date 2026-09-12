const fs = require('fs');

const filePath = 'src/pages/admin/Dashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add showUserMenu state
if (!content.includes('const [showUserMenu, setShowUserMenu] = useState(false);')) {
  content = content.replace(
    'const [showScanner, setShowScanner] = useState(false);',
    'const [showScanner, setShowScanner] = useState(false);\n  const [showUserMenu, setShowUserMenu] = useState(false);'
  );
}

// Find the <header> block
const headerStart = content.indexOf('<header className="sticky top-0');
const headerEnd = content.indexOf('</header>', headerStart) + '</header>'.length;

const newHeader = `
      {/* Admin Modern Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm print:hidden">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-md shrink-0">
              {clinicProfile?.clinicName ? clinicProfile.clinicName.charAt(0).toUpperCase() : 'D'}
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate tracking-tight">
                {clinicProfile?.clinicName || 'Dental Smart'}
              </h1>
              {clinicProfile?.doctorName && (
                <p className="text-xs text-slate-500 font-medium truncate">
                  BS. {clinicProfile.doctorName}
                </p>
              )}
            </div>
          </div>

          {/* Main Navigation (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 absolute left-1/2 -translate-x-1/2">
            {hasPermission('appointment.view') && (
              <button 
                onClick={() => setActiveTab('appointments')}
                className={\`text-sm font-semibold flex items-center px-4 py-2 rounded-full transition-all \${
                  activeTab === 'appointments' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Lịch hẹn
              </button>
            )}
            {hasPermission('patient.view') && (
              <button 
                onClick={() => setActiveTab('patients')}
                className={\`text-sm font-semibold flex items-center px-4 py-2 rounded-full transition-all \${
                  activeTab === 'patients' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <Users className="w-4 h-4 mr-2" />
                Hồ sơ Bệnh án
              </button>
            )}
            {!isSimpleMode && hasPermission('service.manage') && (
              <button 
                onClick={() => setActiveTab('services')}
                className={\`text-sm font-semibold flex items-center px-4 py-2 rounded-full transition-all \${
                  activeTab === 'services' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                Dịch vụ & Lịch
              </button>
            )}
            {!isSimpleMode && hasPermission('analytics.view') && (
              <button 
                onClick={() => setActiveTab('analytics')}
                className={\`text-sm font-semibold flex items-center px-4 py-2 rounded-full transition-all \${
                  activeTab === 'analytics' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }\`}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Báo cáo
              </button>
            )}
          </nav>

          {/* Right Actions & User Menu */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick QR Scanner */}
            <button 
              onClick={() => setShowScanner(true)}
              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors hidden sm:flex"
              title="Quét mã QR"
            >
              <QrCode className="w-5 h-5" />
            </button>
            
            {/* User Dropdown Container */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  {user?.username ? user.username.charAt(0).toUpperCase() : <UserCircle2 className="w-5 h-5" />}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-700 leading-tight max-w-[100px] truncate">{user?.username || user?.email}</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight">{user?.role === 'role-admin' || user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</p>
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    
                    <div className="px-4 py-3 border-b border-slate-50">
                      <p className="text-sm font-bold text-slate-800 truncate">{user?.email}</p>
                      <p className="text-xs text-slate-500">{user?.role === 'role-admin' || user?.role === 'admin' ? 'Quản trị viên hệ thống' : 'Nhân viên'}</p>
                    </div>

                    <div className="p-2 flex flex-col gap-1">
                      {hasPermission('setting.manage') && (
                        <button 
                          onClick={() => { setActiveTab('settings'); setShowUserMenu(false); }}
                          className={\`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors \${activeTab === 'settings' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}
                        >
                          <SettingsIcon className="w-4 h-4 mr-3 text-slate-400" />
                          Cài đặt hệ thống
                        </button>
                      )}
                      
                      {hasPermission('user.create') && (
                        <button 
                          onClick={() => { setActiveTab('users'); setShowUserMenu(false); }}
                          className={\`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors \${activeTab === 'users' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}
                        >
                          <ShieldCheck className="w-4 h-4 mr-3 text-slate-400" />
                          Quản lý nhân sự
                        </button>
                      )}
                    </div>

                    <div className="p-2 border-t border-slate-50 flex flex-col gap-1">
                      {user?.tenantId && (
                        <button 
                          onClick={() => {
                            if (!isConnected) connectGoogleStore();
                          }}
                          className={\`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors \${
                            isConnected 
                              ? 'text-emerald-700 bg-emerald-50 pointer-events-none' 
                              : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                          }\`}
                        >
                          {isConnected ? <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 mr-3 text-amber-500" />}
                          {isConnected ? 'Đã kết nối Google' : 'Kết nối Google Drive'}
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          if (!audioEnabled) {
                            ServerSpeechEngine.init();
                            setAudioEnabled(true);
                          } else {
                            ServerSpeechEngine.cancel();
                            setAudioEnabled(false);
                          }
                        }}
                        className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <div className="flex items-center">
                          {audioEnabled ? <Volume2 className="w-4 h-4 mr-3 text-emerald-500" /> : <VolumeX className="w-4 h-4 mr-3 text-slate-400" />}
                          Âm thanh thông báo
                        </div>
                        <div className={\`w-8 h-4 rounded-full relative transition-colors \${audioEnabled ? 'bg-emerald-500' : 'bg-slate-300'}\`}>
                          <div className={\`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform \${audioEnabled ? 'left-4.5' : 'left-0.5'}\`}></div>
                        </div>
                      </button>
                    </div>

                    <div className="p-2 border-t border-slate-50">
                      <button 
                        onClick={logout}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <LogOut className="w-4 h-4 mr-3 text-red-500" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
`;

content = content.substring(0, headerStart) + newHeader + content.substring(headerEnd);

// Also need to make sure QrCode icon is imported
if (!content.includes('QrCode')) {
  content = content.replace('LogOut,', 'LogOut, QrCode,');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated Dashboard.tsx");
