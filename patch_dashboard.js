import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const importTarget = `import Analytics from './Analytics';`;
const importReplace = `import Analytics from './Analytics';
import OtpQuotaWidget from './components/OtpQuotaWidget';`;
code = code.replace(importTarget, importReplace);

const renderTarget = `                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-slate-700">Xuất báo cáo</span>
              </button>
            )}
            
            {/* Header User/Actions Menu */}`;

const renderReplace = `                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-slate-700">Xuất báo cáo</span>
              </button>
            )}
            
            {/* OTP Quota Widget for Super Admin */}
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
               <div className="hidden sm:block mr-2">
                 <OtpQuotaWidget />
               </div>
            )}
            
            {/* Header User/Actions Menu */}`;

code = code.replace(renderTarget, renderReplace);

// if not found, we'll find another spot
if (!code.includes('<OtpQuotaWidget />')) {
  console.log("fallback injection");
  const fbTarget = `              <span className="font-semibold text-slate-700">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>`;
  const fbReplace = `              <span className="font-semibold text-slate-700">Đăng xuất</span>
            </button>
          </div>
        </div>
        
        {/* Mobile OTP Widget */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
           <div className="px-4 py-2 sm:hidden border-b border-slate-200">
             <OtpQuotaWidget />
           </div>
        )}
      </header>`;
  code = code.replace(fbTarget, fbReplace);
}

fs.writeFileSync(file, code);
