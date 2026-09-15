import fs from 'fs';
const file = 'src/pages/admin/ServicesConfig.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `<button
            type="button"
            onClick={() => {
              setEditingService({ 
                name: '', 
                durationMins: 30, 
                bufferBefore: 0, 
                bufferAfter: 10, 
                price: '', 
                showPrice: true, 
                isHot: false, 
                isFree: false, 
                isActive: true,
                tags: []
              });
              setShowServiceForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm dịch vụ</span>
          </button>
          )}
          {hasPermission('provider.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingProvider({ 
                name: '', 
                specialty: '', 
                experience: '',
                isDefault: false, 
                isActive: true, 
                bookingEnabled: true,
                specialties: [],
                certificates: []
              });
              setShowProviderForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bác sĩ</span>
          </button>
          )}`;

const replacement = `{hasPermission('service.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingService({ 
                name: '', 
                durationMins: 30, 
                bufferBefore: 0, 
                bufferAfter: 10, 
                price: '', 
                showPrice: true, 
                isHot: false, 
                isFree: false, 
                isActive: true,
                tags: []
              });
              setShowServiceForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm dịch vụ</span>
          </button>
          )}
          {hasPermission('provider.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingProvider({ 
                name: '', 
                specialty: '', 
                experience: '',
                isDefault: false, 
                isActive: true, 
                bookingEnabled: true,
                specialties: [],
                certificates: []
              });
              setShowProviderForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bác sĩ</span>
          </button>
          )}`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
