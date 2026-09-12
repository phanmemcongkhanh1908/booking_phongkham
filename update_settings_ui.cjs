const fs = require('fs');
const file = 'src/pages/admin/Settings.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('idleTimeoutMinutes')) {
  // Add state
  code = code.replace(
    "const [telegramTesting, setTelegramTesting] = useState(false);",
    "const [telegramTesting, setTelegramTesting] = useState(false);\n  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState('30');"
  );
  
  // Update fetch
  code = code.replace(
    "if (res.data.data.clinicProfile) setClinicProfile(res.data.data.clinicProfile);",
    "if (res.data.data.clinicProfile) setClinicProfile(res.data.data.clinicProfile);\n      if (res.data.data.idleTimeoutMinutes !== undefined) setIdleTimeoutMinutes(String(res.data.data.idleTimeoutMinutes));"
  );
  
  // Update save
  code = code.replace(
    "await api.post('/admin/settings', { clinicProfile });",
    "await api.post('/admin/settings', { clinicProfile, idleTimeoutMinutes: Number(idleTimeoutMinutes) });"
  );
  
  // Update UI
  const clinicProfileBlockEnd = `            <Button onClick={saveClinicProfile} disabled={savingSettings} className="mt-4">
              {savingSettings ? 'Đang lưu...' : 'Lưu Thông Tin'}
            </Button>
          </div>
        </CardContent>
      </Card>`;
      
  const insertUI = `              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-slate-500" />
                  Thời gian khóa màn hình tự động (phút)
                </label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="VD: 30" 
                    value={idleTimeoutMinutes}
                    onChange={(e) => setIdleTimeoutMinutes(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <span className="text-sm text-slate-500">phút (Nhập 0 để tắt chức năng)</span>
                </div>
              </div>

            <Button onClick={saveClinicProfile} disabled={savingSettings} className="mt-6">
              {savingSettings ? 'Đang lưu...' : 'Lưu Cài Đặt Chung'}
            </Button>
          </div>
        </CardContent>
      </Card>`;
      
  code = code.replace(clinicProfileBlockEnd, insertUI);
  fs.writeFileSync(file, code);
}
