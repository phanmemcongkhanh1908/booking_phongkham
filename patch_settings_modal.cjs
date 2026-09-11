const fs = require('fs');
const path = 'src/pages/admin/Settings.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import SyncDiagnosticModal')) {
    content = content.replace(
        "import { \n  findOrCreateClinicSpreadsheet,", 
        "import SyncDiagnosticModal from './components/SyncDiagnosticModal';\nimport { forceSyncAppointmentsToSheet } from '../../lib/googleWorkspace';\nimport { \n  findOrCreateClinicSpreadsheet,"
    );
}

if (!content.includes('const [isDiagnosticOpen, setIsDiagnosticOpen]')) {
    content = content.replace(
        "const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);",
        "const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);\n  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);"
    );
}

const forceSyncFn = `
  const handleForceSyncAllAppointments = async () => {
    if (!googleToken) return;
    try {
      let targetSheetId = spreadsheetId;
      if (!targetSheetId) {
        const sheetInfo = await findOrCreateClinicSpreadsheet(googleToken, 'Dental Smart');
        targetSheetId = sheetInfo.spreadsheetId;
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
      }
      const res = await api.get('/appointments');
      const allAppts = res.data?.data || [];
      const syncResult = await forceSyncAppointmentsToSheet(allAppts, googleToken, targetSheetId);
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastSyncAt(timeStr);
      setGoogleStatusMsg({
        type: 'success',
        text: \`Đã làm mới đồng bộ thành công toàn bộ \${syncResult.count} lịch hẹn sang Google Sheets lúc \${timeStr}!\`
      });
    } catch (e: any) {
      console.error('Lỗi làm mới đồng bộ:', e);
      setGoogleStatusMsg({
        type: 'error',
        text: 'Lỗi làm mới đồng bộ: ' + (e.message || 'Vui lòng kiểm tra quyền truy cập.')
      });
    }
  };
`;

if (!content.includes('handleForceSyncAllAppointments')) {
    content = content.replace(
        "const handleSaveManualSheet = () => {",
        forceSyncFn + "\n  const handleSaveManualSheet = () => {"
    );
}

const diagnosticButton = `
                  <Button
                    onClick={() => setIsDiagnosticOpen(true)}
                    variant="outline"
                    className="text-xs font-semibold px-3 py-2 rounded-xl text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 gap-1.5"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Chẩn đoán Đồng bộ</span>
                  </Button>
`;

if (!content.includes('onClick={() => setIsDiagnosticOpen(true)}')) {
    content = content.replace(
        /<Button\s+onClick=\{handleSyncAllAppointments\}/g,
        diagnosticButton + "\n                  <Button\n                    onClick={handleSyncAllAppointments}"
    );
}

const modalRender = `
      {isDiagnosticOpen && (
        <SyncDiagnosticModal 
          onClose={() => setIsDiagnosticOpen(false)}
          onForceSyncAll={handleForceSyncAllAppointments}
        />
      )}
`;

if (!content.includes('<SyncDiagnosticModal')) {
    content = content.replace(
        "export default AdminSettings;",
        modalRender + "\nexport default AdminSettings;"
    );
    // actually, let's put it before the last `</div>` of the component.
}

fs.writeFileSync(path, content);
console.log('Patched Settings.tsx');
