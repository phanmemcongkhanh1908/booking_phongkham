const fs = require('fs');

const filePath = 'src/pages/admin/UsersManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const startStr = '{showModal && (';
const endStr = '      )}\n    </div>\n  );\n}';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newModal = `{showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">
                {modalMode === 'create' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 grow">
              <form id="user-form" onSubmit={handleSubmit} className="space-y-8">
                {msg && (
                  <div className={\`text-sm p-4 rounded-xl border flex items-center gap-3 \${
                    isError 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }\`}>
                    {isError ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    <span className="font-medium">{msg}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Cột 1: Thông tin cơ bản */}
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Thông tin đăng nhập
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Tên tài khoản / Email</label>
                          <input 
                            type="text" 
                            placeholder="VD: admin hoặc admin@phongkham.vn" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required={modalMode === 'create'}
                            disabled={modalMode === 'edit'}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                          />
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            {modalMode === 'edit' ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
                          </label>
                          <div className="relative">
                            <input 
                              type={showPassword ? 'text' : 'password'} 
                              placeholder="Tối thiểu 6 ký tự" 
                              value={password} 
                              onChange={e => setPassword(e.target.value)} 
                              required={modalMode === 'create'}
                              className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Xác nhận mật khẩu
                          </label>
                          <div className="relative">
                            <input 
                              type={showConfirmPassword ? 'text' : 'password'} 
                              placeholder="Nhập lại mật khẩu" 
                              value={confirmPassword} 
                              onChange={e => setConfirmPassword(e.target.value)} 
                              required={modalMode === 'create' || (modalMode === 'edit' && password.length > 0)}
                              className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Cấu hình phòng khám
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Đường dẫn định danh (Slug)</label>
                          <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="VD: nha-khoa-le-phuong"
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
                            Đường dẫn đặt khám: <br/>
                            <a href={\`\${window.location.origin}/booking/\${slug || '...'}\`} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline break-all">
                              {window.location.origin}/booking/{slug || '...'}
                            </a>
                          </p>
                        </div>
                        
                        {slug && (
                          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0">
                              <QRCodeSVG 
                                id="qr-code-canvas"
                                value={\`\${window.location.origin}/booking/\${slug}\`} 
                                size={80} 
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-slate-700 font-medium">Mã QR đặt lịch</p>
                              <p className="text-xs text-slate-500 leading-relaxed">Bệnh nhân có thể quét mã này để truy cập trực tiếp vào trang đặt lịch của phòng khám.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const canvas = document.getElementById('qr-code-canvas');
                                  if (canvas) {
                                    // qrcode.react renders as SVG by default, we need to convert it or use canvas. 
                                    // Let's change QRCodeSVG to QRCodeCanvas if we want simple download, but SVG download is also possible.
                                    // Since we imported QRCodeSVG, we can download it as SVG.
                                    const svgData = new XMLSerializer().serializeToString(canvas);
                                    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = \`qr-\${slug}.svg\`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Tải mã QR
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">Giao diện hiển thị</label>
                          <select
                            value={uiMode}
                            onChange={(e) => setUiMode(e.target.value as 'full' | 'simple')}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                          >
                            <option value="full">Đầy đủ (Nâng cao)</option>
                            <option value="simple">Đơn giản (Tối giản)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Phân quyền */}
                  <div>
                    <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      Phân quyền chức năng
                    </h4>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/50 h-[calc(100%-2rem)] overflow-y-auto divide-y divide-slate-200/60 shadow-inner">
                      {PERMISSION_MATRIX.map(module => (
                        <div key={module.module} className="p-5 space-y-4">
                          <h5 className="text-sm font-bold text-slate-800">{module.module}</h5>
                          <div className="flex flex-col gap-3">
                            {module.permissions.map(p => (
                              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:border-primary checked:bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    checked={selectedPermissions.includes('*') || selectedPermissions.includes(p.id)}
                                    disabled={p.id !== '*' && selectedPermissions.includes('*')}
                                    onChange={(e) => {
                                      if (p.id === '*') {
                                        setSelectedPermissions(e.target.checked ? ['*'] : []);
                                      } else {
                                        setSelectedPermissions(prev => 
                                          e.target.checked 
                                            ? [...prev.filter(id => id !== '*'), p.id] 
                                            : prev.filter(id => id !== p.id)
                                        );
                                      }
                                    }}
                                  />
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                                </div>
                                <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 transition-colors select-none">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                form="user-form"
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70 shadow-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
`;
  
  content = content.substring(0, startIndex) + newModal + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Success");
} else {
  console.log("Could not find boundaries");
}
