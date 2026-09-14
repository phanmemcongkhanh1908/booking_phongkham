const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const targetStr = `                                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 ml-1">
                                        <Zap className="w-4 h-4" />
                                        Dịch vụ rút gọn ngoài (Zalo/SMS)
                                      </div>`;

const replaceStr = `                                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 ml-1">
                                        <Zap className="w-4 h-4" />
                                        Dịch vụ rút gọn ngoài (Tùy chọn)
                                      </div>`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Patched Zalo/SMS text');
