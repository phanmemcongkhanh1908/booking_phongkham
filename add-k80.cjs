const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/components/PrintTemplates.tsx', 'utf8');

const k80Template = `
export const K80ReceiptTemplate = forwardRef<HTMLDivElement, { patient: any, total: number, paid: number, newDebt: number, oldDebt: number, forPrint?: boolean }>(({ patient, total, paid, newDebt, oldDebt, forPrint = false }, ref) => {
  return (
    <div 
      ref={ref} 
      className="bg-white text-black font-sans mx-auto"
      style={{ 
        width: '80mm', /* K80 Width */
        padding: '5mm',
        boxSizing: 'border-box',
        ...(forPrint ? {} : { position: 'absolute', left: '-9999px', top: '-9999px' })      
      }}
    >
      {/* Header */}
      <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
        <h1 className="text-lg font-extrabold uppercase">DENTAL SMART</h1>
        <p className="text-[10px] font-bold uppercase mt-0.5">Nha Khoa Thẩm Mỹ</p>
        <p className="text-[10px] mt-1">123 Đường ABC, TP.HCM</p>
        <p className="text-[10px]">Hotline: 1900 xxxx</p>
      </div>

      {/* Title */}
      <div className="text-center mb-3">
        <h2 className="text-[14px] font-bold uppercase">PHIẾU THU</h2>
        <p className="text-[10px]">Ngày: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>

      {/* Patient Info */}
      <div className="mb-3 text-[11px] leading-tight space-y-1">
        <p><span className="font-semibold">Khách hàng:</span> {patient?.fullName}</p>
        <p><span className="font-semibold">Mã KH:</span> #{patient?.id?.slice(0,6).toUpperCase()}</p>
        <p><span className="font-semibold">Điện thoại:</span> {patient?.phone}</p>
        <p><span className="font-semibold">Ghi chú:</span> {getNoteText(patient?.notes)}</p>
      </div>

      {/* Table */}
      <div className="mb-3 border-t border-b border-black border-dashed py-2 text-[11px]">
        <div className="flex justify-between mb-1 font-semibold">
          <span>Nội dung</span>
          <span>Số tiền</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Nợ kỳ trước</span>
          <span>{oldDebt.toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Chi phí hôm nay</span>
          <span>{total.toLocaleString('vi-VN')}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 text-[11px] space-y-1">
        <div className="flex justify-between">
          <span className="font-semibold">Cần thanh toán:</span>
          <span>{(oldDebt + total).toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between text-[12px] font-bold mt-1">
          <span>Đã thanh toán:</span>
          <span>{paid.toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between mt-1 pt-1 border-t border-black border-dashed font-bold">
          <span>Công nợ còn lại:</span>
          <span>{newDebt.toLocaleString('vi-VN')}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] italic">
        <p>Cảm ơn quý khách!</p>
        <p>Hẹn gặp lại</p>
      </div>
    </div>
  );
});
`;

if (!content.includes("export const K80ReceiptTemplate")) {
  content = content + "\n" + k80Template;
  fs.writeFileSync('src/pages/admin/components/PrintTemplates.tsx', content);
}

