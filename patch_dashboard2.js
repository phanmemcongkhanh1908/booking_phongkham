import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `<header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-6">`;
const replace = `<header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3 sm:px-6">
        {/* Mobile OTP Widget */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
           <div className="sm:hidden mb-3">
             <OtpQuotaWidget />
           </div>
        )}`;

code = code.replace(target, replace);

const target2 = `              <LogOut className="w-5 h-5 text-slate-500" />
              <span className="font-semibold text-slate-700">Đăng xuất</span>
            </button>
          </div>`;
          
const replace2 = `              <LogOut className="w-5 h-5 text-slate-500" />
              <span className="font-semibold text-slate-700">Đăng xuất</span>
            </button>
          </div>
          
          {/* OTP Quota Widget for Super Admin */}
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
             <div className="hidden sm:block ml-4 border-l border-slate-200 pl-4">
               <OtpQuotaWidget />
             </div>
          )}`;
          
code = code.replace(target2, replace2);

fs.writeFileSync(file, code);
