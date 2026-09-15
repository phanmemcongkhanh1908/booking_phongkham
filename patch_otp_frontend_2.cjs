const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

const targetStr = `                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={verifyName || ''}
                        onChange={e => setVerifyName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleVerifyName())}
                        placeholder="Nhập họ và tên..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyName}
                      disabled={isVerifying}
                      className="whitespace-nowrap px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                    >
                      {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Xác thực
                    </button>
                  </div>`;

const replaceStr = `                  <div className="flex flex-col sm:flex-row gap-2">
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="w-full whitespace-nowrap px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Gửi mã OTP (Zalo/SMS)
                      </button>
                    ) : (
                      <>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={otpCode || ''}
                            onChange={e => setOtpCode(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleVerifyOtp())}
                            placeholder="Nhập mã OTP..."
                            maxLength={6}
                            className="w-full px-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-base sm:text-sm font-semibold text-slate-800 bg-white text-center font-mono tracking-widest"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isVerifying}
                          className="whitespace-nowrap px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-xs flex items-center justify-center gap-1.5 min-w-[100px]"
                        >
                          {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          Xác thực
                        </button>
                      </>
                    )}
                  </div>`;

code = code.replace(targetStr, replaceStr);

// Also fix the text just above it:
code = code.replace(
  'Vui lòng nhập <strong className="text-slate-800">Họ và Tên</strong> của bạn để hệ thống tự động điền hồ sơ.',
  'Vui lòng xác thực bằng mã OTP để hệ thống tự động điền hồ sơ và bảo vệ dữ liệu y tế.'
);

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', code);
