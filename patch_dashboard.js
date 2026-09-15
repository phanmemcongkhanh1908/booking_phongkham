import fs from 'fs';
let file = 'src/pages/admin/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { useGoogleAuthStore } from '../../store/googleAuthStore';",
  "import { useGoogleAuthStore } from '../../store/googleAuthStore';\nimport { fetchDriveQuota, formatBytes } from '../../lib/googleWorkspace';"
);

code = code.replace(
  "const { isConnected, init: initGoogleAuth, connect: connectGoogleStore } = useGoogleAuthStore();",
  "const { isConnected, accessToken, init: initGoogleAuth, connect: connectGoogleStore } = useGoogleAuthStore();\n  const [quotaResult, setQuotaResult] = useState<any>(null);\n  const [checkingQuota, setCheckingQuota] = useState(false);"
);

const oldReminderStr = `                <a 
                  href="https://drive.google.com/settings/storage" 
                  target="_blank" 
                  rel="noreferrer"
                  onClick={dismissStorageReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Kiểm tra dung lượng ngay
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>`;
                
const newReminderStr = `                {!quotaResult ? (
                  <button 
                    onClick={async () => {
                      if (!accessToken) return;
                      setCheckingQuota(true);
                      try {
                        const res = await fetchDriveQuota(accessToken);
                        setQuotaResult(res);
                        // Record check in localstorage but don't dismiss banner yet
                        if (user?.id) localStorage.setItem('lastStorageCheckDate_' + user.id, Date.now().toString());
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setCheckingQuota(false);
                      }
                    }}
                    disabled={checkingQuota}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-wait"
                  >
                    {checkingQuota ? 'Đang kiểm tra...' : 'Kiểm tra dung lượng ngay'}
                    {!checkingQuota && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <div className="bg-white/80 p-3 rounded-lg border border-blue-100 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Đã sử dụng: {formatBytes(quotaResult.usage)} / {formatBytes(quotaResult.limit)}</div>
                      <div className="text-xs text-slate-500 mt-1">Dung lượng rác: {formatBytes(quotaResult.usageInDriveTrash)}</div>
                    </div>
                    <button 
                      onClick={() => setShowStorageReminder(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                    >
                      Đóng
                    </button>
                  </div>
                )}`;

code = code.replace(oldReminderStr, newReminderStr);

fs.writeFileSync(file, code);
