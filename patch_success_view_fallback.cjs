const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

const targetStr = `        <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
          {bookingFormConfig?.preVisitNotes?.map((note: string, index: number) => {`;

const replaceStr = `        <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
          {(bookingFormConfig?.preVisitNotes || [
            'Vui lòng mang theo **CCCD / Căn cước** hoặc **BHYT** (nếu có) để đối chiếu thông tin và làm thủ tục hành chính nhanh chóng.',
            'Quý khách nên có mặt trước giờ hẹn **10 phút** để nhân viên lễ tân hỗ trợ chuẩn bị hồ sơ y tế tốt nhất.',
            'Vì lý do chuyên môn, nếu quý khách đến trễ quá 15 phút, phòng khám có thể sẽ linh động sắp xếp khung giờ tiếp theo để không ảnh hưởng đến bệnh nhân khác.',
            \`Nếu có thay đổi, vui lòng thông báo hủy hoặc dời lịch trước **24h** qua hotline **\${phone || 'phòng khám'}**.\`
          ]).map((note: string, index: number) => {`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', code);
console.log('SuccessView.tsx fallback patched');
