import fs from 'fs';
let file = 'src/pages/admin/UsersManagement.tsx';
let code = fs.readFileSync(file, 'utf8');

// Fix 1: Modal container layout (if not already applied)
const modalTarget = `<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">`;
const modalReplace = `<div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white sm:rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-full sm:h-auto sm:max-h-[92vh]">`;
if (code.includes(modalTarget)) {
    code = code.replace(modalTarget, modalReplace);
}

// Fix 2: Slug input layout
const slugInputTarget = `<div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10 transition-all shadow-2xs">
                      <span className="px-3.5 py-2.5 bg-slate-100 text-slate-500 font-mono text-xs border-r border-slate-200 shrink-0 font-medium select-none">
                        {window.location.origin}/booking/
                      </span>
                      <input
                        type="text"
                        value={slug || ''}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="VD: nha-khoa-le-phuong"
                        className="flex-1 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                      />
                    </div>`;

const slugInputReplace = `<div className="flex flex-col sm:flex-row sm:items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10 transition-all shadow-2xs">
                      <span className="px-3.5 py-2 sm:py-2.5 bg-slate-100 text-slate-500 font-mono text-[10px] sm:text-xs border-b sm:border-b-0 sm:border-r border-slate-200 shrink-0 font-medium select-none truncate">
                        {window.location.origin}/booking/
                      </span>
                      <input
                        type="text"
                        value={slug || ''}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="VD: nha-khoa-le-phuong"
                        className="flex-1 w-full min-w-0 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                      />
                    </div>`;

if (code.includes(slugInputTarget)) {
    code = code.replace(slugInputTarget, slugInputReplace);
} else {
    console.log("Could not find slug input target");
}

fs.writeFileSync(file, code);
