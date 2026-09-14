const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/DateTimeSelection.tsx', 'utf8');

const targetStr = `            {extendedProviders.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProviderId(p.id)}
                className={\`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer \${
                  selectedProviderId === p.id
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }\`}
              >
                {p.title ? \`\${p.title} \` : 'BS. '}{p.name}
              </button>
            ))}
          </div>
        </div>
      )}`;

const replacementStr = `            {extendedProviders.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProviderId(p.id)}
                className={\`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer \${
                  selectedProviderId === p.id
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }\`}
              >
                {p.title ? \`\${p.title} \` : 'BS. '}{p.name}
              </button>
            ))}
          </div>
          
          {/* Doctor Profile Card */}
          {selectedProviderId && selectedProviderId !== null && (
            <div className="mt-4 p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="w-12 h-12 rounded-full bg-teal-200 border-2 border-white shadow-sm flex items-center justify-center text-teal-800 font-bold text-lg shrink-0">
                 {extendedProviders.find((p: any) => p.id === selectedProviderId)?.name?.charAt(0) || 'BS'}
               </div>
               <div>
                 <h4 className="font-bold text-teal-900 text-[14px]">
                   {extendedProviders.find((p: any) => p.id === selectedProviderId)?.title || 'BS. '}
                   {extendedProviders.find((p: any) => p.id === selectedProviderId)?.name}
                 </h4>
                 <p className="text-[12px] text-teal-700 font-medium mt-0.5">
                   {extendedProviders.find((p: any) => p.id === selectedProviderId)?.experience}
                 </p>
                 <div className="flex flex-wrap gap-1.5 mt-2">
                   {extendedProviders.find((p: any) => p.id === selectedProviderId)?.specialties?.map((spec: string, i: number) => (
                     <span key={i} className="px-2 py-0.5 bg-white text-teal-700 border border-teal-200 rounded-md text-[10px] font-bold tracking-wider uppercase">
                       {spec}
                     </span>
                   ))}
                 </div>
                 <div className="mt-2 space-y-1">
                    {extendedProviders.find((p: any) => p.id === selectedProviderId)?.certificates?.map((cert: string, i: number) => (
                      <p key={i} className="text-[11px] text-teal-800/80 flex items-start gap-1.5 leading-tight">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {cert}
                      </p>
                    ))}
                 </div>
               </div>
            </div>
          )}
        </div>
      )}`;

if (content.includes(targetStr) && !content.includes('Doctor Profile Card')) {
    content = content.replace(targetStr, replacementStr);
}

fs.writeFileSync('src/pages/public/components/DateTimeSelection.tsx', content);
