const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// Add jsPDF import
if (!content.includes("import { jsPDF }")) {
  content = content.replace("import html2canvas from 'html2canvas';", "import html2canvas from 'html2canvas';\nimport { jsPDF } from 'jspdf';");
}

// Add state
if (!content.includes("const [telegramFormat")) {
  content = content.replace("const [telegramSuccess, setTelegramSuccess] = useState('');", "const [telegramSuccess, setTelegramSuccess] = useState('');\n  const [telegramFormat, setTelegramFormat] = useState<'png' | 'pdf'>('png');");
}

// Modify handleSendTelegram
const oldCode = `      const canvas = await html2canvas(targetRef.current, { scale: 2 });
      const base64Data = canvas.toDataURL('image/png');
      
      targetRef.current.style.left = '-9999px';
      targetRef.current.style.top = '-9999px';

      const res = await api.post(\`/patients/\${selectedPatient?.id}/send-document\`, {
        telegramId: telegramIdInput,
        base64Data,
        filename: showTelegramModal === 'receipt' ? 'Phieu_Thu.png' : 'Ho_So_Benh_An.png',`;

const newCode = `      const canvas = await html2canvas(targetRef.current, { scale: 2 });
      
      let base64Data = '';
      let filename = '';
      
      if (telegramFormat === 'png') {
        base64Data = canvas.toDataURL('image/png');
        filename = showTelegramModal === 'receipt' ? 'Phieu_Thu.png' : 'Ho_So_Benh_An.png';
      } else {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: showTelegramModal === 'receipt' ? 'a5' : 'a4'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        base64Data = pdf.output('datauristring');
        filename = showTelegramModal === 'receipt' ? 'Phieu_Thu.pdf' : 'Ho_So_Benh_An.pdf';
      }
      
      targetRef.current.style.left = '-9999px';
      targetRef.current.style.top = '-9999px';

      const res = await api.post(\`/patients/\${selectedPatient?.id}/send-document\`, {
        telegramId: telegramIdInput,
        base64Data,
        filename: filename,`;

content = content.replace(oldCode, newCode);

// Add radio buttons to modal UI
const uiOld = `                <Input 
                  value={telegramIdInput} 
                  onChange={e => setTelegramIdInput(e.target.value)} 
                  placeholder="VD: @nguyenvana hoặc Chat ID" 
                  className="bg-bg-base text-sm h-10" 
                />
                <p className="text-[11px] text-text-muted mt-1.5 italic">
                  *Nếu khách hàng đã đăng ký Telegram từ trước, mã sẽ được tự động điền. Bạn có thể sửa đổi nếu cần.
                </p>
              </div>`;

const uiNew = `                <Input 
                  value={telegramIdInput} 
                  onChange={e => setTelegramIdInput(e.target.value)} 
                  placeholder="VD: @nguyenvana hoặc Chat ID" 
                  className="bg-bg-base text-sm h-10" 
                />
                <p className="text-[11px] text-text-muted mt-1.5 italic">
                  *Nếu khách hàng đã đăng ký Telegram từ trước, mã sẽ được tự động điền. Bạn có thể sửa đổi nếu cần.
                </p>
              </div>
              
              <div className="pt-2">
                <label className="font-bold text-text-main block mb-2">Định dạng gửi</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="telegramFormat" value="png" checked={telegramFormat === 'png'} onChange={() => setTelegramFormat('png')} className="w-4 h-4 text-primary" />
                    <span className="text-sm text-text-main">Hình ảnh (PNG)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="telegramFormat" value="pdf" checked={telegramFormat === 'pdf'} onChange={() => setTelegramFormat('pdf')} className="w-4 h-4 text-primary" />
                    <span className="text-sm text-text-main">Tài liệu (PDF)</span>
                  </label>
                </div>
              </div>`;

content = content.replace(uiOld, uiNew);

fs.writeFileSync('src/pages/admin/Patients.tsx', content);

