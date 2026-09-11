const fs = require('fs');

const path = 'src/pages/admin/Settings.tsx';
let content = fs.readFileSync(path, 'utf8');

const wipeLogic = `
    try {
      const res = await api.post('/admin/wipe');
      let successMessage = res.data?.message || 'Đã xóa sạch toàn bộ dữ liệu phòng khám thành công.';
      
      // Clear Google Sheets if connected
      const googleState = useGoogleAuthStore.getState();
      if (googleState.accessToken && googleState.spreadsheetId) {
         try {
           const sheetRes = await fetch(\`https://sheets.googleapis.com/v4/spreadsheets/\${googleState.spreadsheetId}/values/Appointments:clear\`, {
             method: 'POST',
             headers: {
               'Authorization': \`Bearer \${googleState.accessToken}\`
             }
           });
           if (sheetRes.ok) {
              successMessage += ' Dữ liệu trên Google Sheets cũng đã được xóa sạch.';
           } else {
              console.warn('Could not clear Google Sheets:', await sheetRes.text());
              successMessage += ' (Không thể tự động xóa dữ liệu trên Google Sheets, bạn có thể xóa thủ công).';
           }
         } catch(e) {
           console.error('Error clearing Google Sheets:', e);
         }
      }

      setDataMsg(successMessage);
      setIsDataError(false);
      setIsWipeModalOpen(false);
      setWipeConfirmInput('');
    } catch (e: any) {
`;

// we need to replace the try block in handleExecuteWipe
// Original:
//     try {
//       const res = await api.post('/admin/wipe');
//       const successMessage = res.data?.message || 'Đã xóa sạch toàn bộ dữ liệu phòng khám thành công.';
//       setDataMsg(successMessage);
//       setIsDataError(false);
//       setIsWipeModalOpen(false);
//       setWipeConfirmInput('');
//     } catch (e: any) {

content = content.replace(
  /try \{\s*const res = await api\.post\('\/admin\/wipe'\);\s*const successMessage = [^;]+;\s*setDataMsg\(successMessage\);\s*setIsDataError\(false\);\s*setIsWipeModalOpen\(false\);\s*setWipeConfirmInput\(''\);\s*\} catch \(e: any\) \{/s,
  wipeLogic.trim() + ' catch (e: any) {'
);

fs.writeFileSync(path, content);
console.log('patched Settings.tsx wipe logic');
