const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

const targetStr = `{/* Health Notes Section */}`;

const replaceStr = `{/* Hình ảnh y khoa (Idea 3) */}
          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200/60 mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-teal-600" />
              Tải lên Hình ảnh / Hồ sơ (Tùy chọn)
            </h3>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
                <div className="flex text-[13px] text-slate-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-semibold text-teal-700 hover:text-teal-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-700 focus-within:ring-offset-2 px-2 py-0.5">
                    <span>Chọn file</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*,.pdf" onChange={(e) => {
                      if (e.target.files) {
                        setUploadedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                      }
                    }} />
                  </label>
                  <p className="pl-1">hoặc kéo thả vào đây</p>
                </div>
                <p className="text-[11px] text-slate-500">PNG, JPG, PDF tối đa 10MB</p>
              </div>
            </div>
            {uploadedFiles.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-white">
                {uploadedFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between py-2 pl-3 pr-4 text-[12px]">
                    <div className="flex w-0 flex-1 items-center">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="ml-2 w-0 flex-1 truncate text-slate-600 font-medium">{file.name}</span>
                    </div>
                    <div className="ml-4 shrink-0">
                      <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} className="font-medium text-rose-500 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Health Notes Section */}`;

if (content.includes(targetStr) && !content.includes('Hình ảnh y khoa')) {
    content = content.replace(targetStr, replaceStr);
}

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', content);
