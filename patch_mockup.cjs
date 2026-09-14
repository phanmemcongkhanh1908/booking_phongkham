const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const targetStr = `<div className="lg:col-span-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col items-center gap-3.5 text-center">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 inline-flex items-center justify-center">
                            <QRCodeSVG 
                              id="qr-code-canvas"
                              value={currentActiveUrl || \`\${window.location.origin}/b/\${slug}\`} 
                              size={130} 
                              level="M"
                              includeMargin={false}
                              fgColor="#0f172a"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <span className="inline-block text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/70">
                              Mã QR tự động cập nhật
                            </span>
                            <p className="text-[11px] text-slate-500 max-w-[200px]">
                              Quét bằng Camera điện thoại hoặc Zalo để mở trang đặt lịch.
                            </p>
                          </div>
                          <div className="w-full space-y-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={handleDownloadStandeePng}
                              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Tải Standee In Quầy (PNG)
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadSvg}
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              Tải file Vector (SVG)
                            </button>
                          </div>
                        </div>`;

const replaceStr = `<div className="lg:col-span-4 flex flex-col gap-3">
                          {/* Live Mockup Standee */}
                          <div className="bg-slate-100/50 p-4 rounded-2xl flex items-center justify-center relative border border-slate-200 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 opacity-60">
                              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Bản xem trước (Standee)</span>
                            </div>
                            
                            {/* Standee Base */}
                            <div className="w-full max-w-[210px] mt-6 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col transition-all">
                              <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white text-center py-3 px-3 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')]"></div>
                                <div className="flex justify-center mb-1.5 relative z-10">
                                  <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <Building2 className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                                <div className="font-bold text-[11px] uppercase tracking-wider line-clamp-1 relative z-10">
                                  {formUser.fullName || 'TÊN PHÒNG KHÁM'}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 gap-3 bg-white">
                                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Quét mã đặt lịch</div>
                                <div className="p-1.5 border-2 border-slate-100 rounded-lg">
                                  <QRCodeSVG 
                                    id="qr-code-canvas"
                                    value={currentActiveUrl || \`\${window.location.origin}/b/\${slug}\`} 
                                    size={120} 
                                    level="M"
                                    includeMargin={false}
                                    fgColor="#0f172a"
                                  />
                                </div>
                              </div>
                              <div className="bg-slate-50 py-2 px-3 text-center border-t border-slate-100">
                                <div className="text-[9px] text-slate-400 truncate font-mono tracking-tight font-medium">
                                  {currentActiveUrl?.replace(/^https?:\\/\\//, '')}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-full space-y-2 mt-1">
                            <button
                              type="button"
                              onClick={handleDownloadStandeePng}
                              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-xs group"
                            >
                              <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                              Tải Standee In Quầy (PNG)
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadSvg}
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              Tải file Vector (SVG)
                            </button>
                          </div>
                        </div>`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Mockup patched');
