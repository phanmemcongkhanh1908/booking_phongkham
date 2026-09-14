const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const targetStr = `{linkOptions.map(opt => {
                              const isSelected = selectedOptionId === opt.id;
                              return (
                                <div
                                  key={opt.id}
                                  onClick={() => setSelectedOptionId(opt.id)}
                                  className={\`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 \${
                                    isSelected 
                                      ? 'bg-white border-teal-600 ring-2 ring-teal-600/10 shadow-xs' 
                                      : 'bg-white/80 border-slate-200 hover:border-teal-300 hover:bg-white'
                                  }\`}
                                >
                                  <div className="pt-0.5 shrink-0">
                                    <div className={\`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors \${
                                      isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                                    }\`}>
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[13px] font-bold text-slate-900">{opt.name}</span>
                                      {opt.isAdFree && (
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                          100% Không QC
                                        </span>
                                      )}
                                      {opt.type === 'brand' && (
                                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 whitespace-nowrap">
                                          Chính chủ
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                      {opt.tagline}
                                    </p>
                                    <div className="pt-1">
                                      <span className="inline-block font-mono text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 break-all">
                                        {opt.url.replace(/^https?:\\/\\//, '')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}`;

const replaceStr = `(() => {
                              const renderOption = (opt) => {
                                const isDisabled = !!opt.error;
                                const isSelected = selectedOptionId === opt.id && !isDisabled;
                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => !isDisabled && setSelectedOptionId(opt.id)}
                                    className={\`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 relative overflow-hidden \${
                                      isDisabled 
                                        ? 'bg-slate-50 border-slate-200 opacity-75 cursor-not-allowed'
                                        : isSelected 
                                          ? 'bg-white border-teal-600 ring-2 ring-teal-600/10 shadow-xs cursor-pointer' 
                                          : 'bg-white/80 border-slate-200 hover:border-teal-300 hover:bg-white cursor-pointer'
                                    }\`}
                                  >
                                    <div className="pt-0.5 shrink-0">
                                      <div className={\`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors \${
                                        isDisabled ? 'border-slate-300 bg-slate-100' : isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                                      }\`}>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={\`text-[13px] font-bold \${isDisabled ? 'text-slate-500 line-through' : 'text-slate-900'}\`}>{opt.name}</span>
                                        {!isDisabled && opt.isAdFree && (
                                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                                            100% Không QC
                                          </span>
                                        )}
                                        {!isDisabled && opt.type === 'brand' && (
                                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 whitespace-nowrap">
                                            Chính chủ
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 leading-snug">
                                        {opt.tagline}
                                      </p>
                                      
                                      {isDisabled ? (
                                        <div className="pt-1.5">
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {opt.error}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="pt-1 flex flex-wrap items-center gap-2">
                                          <span className="inline-block font-mono text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 break-all">
                                            {opt.url.replace(/^https?:\\/\\//, '')}
                                          </span>
                                          {!isSelected && (
                                            <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-teal-100 transition-opacity">
                                              <Sparkles className="w-3 h-3" />
                                              Đổi mã QR theo link này
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              };

                              const brandOptions = linkOptions.filter(o => o.type === 'brand');
                              const shortOptions = linkOptions.filter(o => o.type === 'short' || o.type === 'full');

                              return (
                                <div className="space-y-4">
                                  <div className="space-y-2.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5 ml-1">
                                      <ShieldCheck className="w-4 h-4" />
                                      Hệ thống khuyên dùng (Ổn định 100%)
                                    </div>
                                    {brandOptions.map(renderOption)}
                                  </div>
                                  
                                  {shortOptions.length > 0 && (
                                    <div className="space-y-2.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 ml-1">
                                        <Zap className="w-4 h-4" />
                                        Dịch vụ rút gọn ngoài (Zalo/SMS)
                                      </div>
                                      {shortOptions.map(renderOption)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}`;

if (code.indexOf('<div className="space-y-2.5">\n                            {linkOptions.map') !== -1) {
  code = code.replace(
    `<div className="space-y-2.5">
                            {linkOptions.map`,
    `<div>
                            {linkOptions.map`
  );
}
code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Options patched');
