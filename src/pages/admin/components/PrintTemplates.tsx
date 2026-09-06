import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { Stethoscope, Phone, MapPin, Globe } from 'lucide-react';

// Common Print Styles
// A4: w-[210mm] min-h-[297mm] (roughly w-[794px])
// A5: w-[148mm] min-h-[210mm] (roughly w-[559px])


const getNoteText = (notes: any) => {
  if (!notes) return 'Không';
  try {
    const parsed = JSON.parse(notes);
    return parsed.text || parsed.diagnosis || parsed.treatmentPlan || 'Không';
  } catch (e) {
    return notes;
  }
};

export const ReceiptTemplate = forwardRef<HTMLDivElement, { patient: any, total?: number, paid?: number, newDebt?: number, oldDebt?: number, forPrint?: boolean }>(({ patient, total = 0, paid = 0, newDebt = 0, oldDebt = 0, forPrint = false }, ref) => {
  const safeOldDebt = Number(oldDebt) || 0;
  const safeTotal = Number(total) || 0;
  const safePaid = Number(paid) || 0;
  const safeNewDebt = Number(newDebt) || 0;

  return (
    <div 
      ref={ref} 
      className="bg-white text-slate-800 font-sans mx-auto shadow-sm relative"
      style={{ 
        width: '148mm', /* A5 Width */
        minHeight: '210mm', /* A5 Height */
        padding: '12mm',
        boxSizing: 'border-box',
        ...(forPrint ? {} : { position: 'absolute', left: '-9999px', top: '-9999px' })
        
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-teal-600 pb-4 mb-5">
        <div className="flex gap-3">
          <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Stethoscope size={28} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-teal-700 tracking-tight leading-tight">DENTAL SMART</h1>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nha Khoa Thẩm Mỹ</p>
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-500 space-y-1">
          <p className="flex items-center justify-end gap-1"><Phone size={10}/> 1900 xxxx</p>
          <p className="flex items-center justify-end gap-1"><MapPin size={10}/> 123 Đường ABC, TP.HCM</p>
          <p className="flex items-center justify-end gap-1"><Globe size={10}/> dentalsmart.vn</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-widest">PHIẾU THU</h2>
        <p className="text-[11px] text-slate-500 mt-1 italic">Ngày: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>

      {/* Patient Info */}
      <div className="bg-slate-50/80 rounded-lg p-3 mb-6 border border-slate-200">
        <div className="grid grid-cols-2 gap-y-2 text-[12px]">
          <div><span className="text-slate-500">Khách hàng:</span> <span className="font-bold text-slate-800 ml-1">{patient?.fullName}</span></div>
          <div><span className="text-slate-500">Mã KH:</span> <span className="font-semibold text-slate-800 ml-1">#{patient?.id?.slice(0,6).toUpperCase()}</span></div>
          <div><span className="text-slate-500">Điện thoại:</span> <span className="font-semibold text-slate-800 ml-1">{patient?.phone}</span></div>
          <div><span className="text-slate-500">Ghi chú:</span> <span className="font-medium text-slate-700 ml-1">{getNoteText(patient?.notes)}</span></div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full mb-6 border-collapse text-[12px]">
        <thead>
          <tr className="bg-teal-50 border-b-2 border-teal-200 text-teal-800">
            <th className="py-2 px-3 text-left font-bold rounded-tl-md">Nội dung</th>
            <th className="py-2 px-3 text-right font-bold rounded-tr-md">Số tiền (VNĐ)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-dashed border-slate-200">
            <td className="py-2.5 px-3 text-slate-600">Nợ kỳ trước</td>
            <td className="py-2.5 px-3 text-right font-medium text-slate-700">{safeOldDebt.toLocaleString('vi-VN')}</td>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <td className="py-2.5 px-3 text-slate-800 font-semibold">Chi phí phát sinh buổi khám</td>
            <td className="py-2.5 px-3 text-right font-bold text-slate-800">{safeTotal.toLocaleString('vi-VN')}</td>
          </tr>
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-end mb-8 text-[12px]">
        <div className="w-2/3 space-y-2">
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-medium">Tổng cộng cần thanh toán:</span>
            <span className="font-bold text-slate-800">{(safeOldDebt + safeTotal).toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex justify-between border-b border-teal-100 pb-1.5 text-teal-700">
            <span className="font-bold">Khách thanh toán hôm nay:</span>
            <span className="font-bold text-[14px]">{safePaid.toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex justify-between bg-slate-100 p-2 rounded-md border border-slate-200 mt-1">
            <span className="text-slate-700 font-bold">Công nợ còn lại:</span>
            <span className="font-bold text-red-600 text-[13px]">{safeNewDebt.toLocaleString('vi-VN')}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between text-center pt-4">
        <div className="w-1/2">
          <p className="font-bold text-slate-700 text-[12px] mb-12">Khách hàng</p>
          <p className="text-[10px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
        </div>
        <div className="w-1/2">
          <p className="font-bold text-slate-700 text-[12px] mb-12">Người thu tiền</p>
          <p className="text-[10px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
        </div>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-[12mm] left-[12mm] right-[12mm] text-center text-[9px] text-slate-400 border-t border-slate-100 pt-3">
        Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của Dental Smart.<br/>
        Phiếu này có giá trị xác nhận thanh toán.
      </div>
    </div>
  );
});

export const MedicalRecordTemplate = forwardRef<HTMLDivElement, { patient: any, records: any[], forPrint?: boolean }>(({ patient, records, forPrint = false }, ref) => {
  return (
    <div 
      ref={ref} 
      className="bg-white text-slate-800 font-sans mx-auto shadow-sm relative"
      style={{ 
        width: '210mm', /* A4 Width */
        minHeight: '297mm', /* A4 Height */
        padding: '20mm',
        boxSizing: 'border-box',
        ...(forPrint ? {} : { position: 'absolute', left: '-9999px', top: '-9999px' })
        
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-[3px] border-teal-600 pb-5 mb-8">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-teal-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
            <Stethoscope size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-teal-700 tracking-tight leading-tight">DENTAL SMART</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Nha Khoa Thẩm Mỹ & Điều Trị</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 space-y-1.5">
          <p className="flex items-center justify-end gap-1.5"><Phone size={12}/> Hotline: 1900 xxxx</p>
          <p className="flex items-center justify-end gap-1.5"><MapPin size={12}/> 123 Đường ABC, Quận X, TP.HCM</p>
          <p className="flex items-center justify-end gap-1.5"><Globe size={12}/> dentalsmart.vn</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-widest">HỒ SƠ BỆNH ÁN</h2>
        <p className="text-sm text-slate-500 mt-2 font-medium">Mã Hồ Sơ: #{patient?.id?.slice(0,8).toUpperCase()}</p>
      </div>

      {/* Patient Info */}
      <div className="bg-slate-50 rounded-xl p-5 mb-8 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
          Thông tin hành chính
        </h3>
        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div><span className="text-slate-500 font-medium">Họ và tên:</span> <span className="font-bold text-slate-800 text-base ml-2 uppercase">{patient?.fullName}</span></div>
          <div><span className="text-slate-500 font-medium">Ngày sinh / Tuổi:</span> <span className="font-semibold text-slate-800 ml-2">{patient?.dob || 'Chưa cập nhật'}</span></div>
          <div><span className="text-slate-500 font-medium">Số điện thoại:</span> <span className="font-semibold text-slate-800 ml-2">{patient?.phone}</span></div>
          <div><span className="text-slate-500 font-medium">Giới tính:</span> <span className="font-semibold text-slate-800 ml-2">{patient?.gender === 'M' ? 'Nam' : patient?.gender === 'F' ? 'Nữ' : 'Chưa cập nhật'}</span></div>
          <div className="col-span-2"><span className="text-slate-500 font-medium">Địa chỉ:</span> <span className="font-medium text-slate-800 ml-2">Chưa cập nhật</span></div>
          <div className="col-span-2 pt-2 border-t border-slate-200/60 mt-1">
            <span className="text-slate-500 font-medium">Tiền sử bệnh / Dị ứng:</span> 
            <span className="font-semibold text-red-600 ml-2">{patient?.allergies || 'Không ghi nhận'}</span>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wider mb-5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
        Chi tiết các lần khám & điều trị
      </h3>
      
      <div className="space-y-6">
        {records.length > 0 ? records.map((record, idx) => (
          <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden break-inside-avoid shadow-sm bg-white">
            <div className="bg-teal-50/60 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
              <span className="font-bold text-teal-800 text-sm">Lần khám {records.length - idx}: {format(new Date(record.visitDate), 'dd/MM/yyyy')}</span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider">Khám & Điều trị</span>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <span className="text-slate-500 font-bold block mb-1.5">Chẩn đoán tình trạng:</span>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-teal-200">{record.diagnosis || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-1.5">Phương hướng / Kế hoạch xử lý:</span>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-teal-200">{record.treatmentPlan || 'Chưa cập nhật'}</p>
              </div>
              {Number(record.cost) > 0 && (
                <div className="pt-2">
                   <span className="text-slate-500 font-bold block mb-1.5">Chi phí điều trị:</span>
                   <p className="text-slate-800 font-medium pl-3 border-l-2 border-teal-200">{(Number(record.cost) || 0).toLocaleString('vi-VN')} VNĐ</p>
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm font-medium">Chưa có lịch sử khám bệnh.</p>
          </div>
        )}
      </div>
      
      {/* Signatures */}
      <div className="flex justify-between text-center pt-12 mt-8 break-inside-avoid">
        <div className="w-1/2"></div>
        <div className="w-1/2">
          <p className="text-xs text-slate-500 italic mb-2">Ngày {format(new Date(), 'dd')} tháng {format(new Date(), 'MM')} năm {format(new Date(), 'yyyy')}</p>
          <p className="font-bold text-slate-700 text-sm mb-20">Bác sĩ điều trị</p>
          <p className="text-xs text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-[15mm] left-[20mm] right-[20mm] text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4 flex justify-between items-center">
        <span>Bản in nội bộ từ hệ thống Dental Smart</span>
        <span>Trang 1/1</span>
      </div>
    </div>
  );
});


export const K80ReceiptTemplate = forwardRef<HTMLDivElement, { patient: any, total?: number, paid?: number, newDebt?: number, oldDebt?: number, forPrint?: boolean }>(({ patient, total = 0, paid = 0, newDebt = 0, oldDebt = 0, forPrint = false }, ref) => {
  const safeOldDebt = Number(oldDebt) || 0;
  const safeTotal = Number(total) || 0;
  const safePaid = Number(paid) || 0;
  const safeNewDebt = Number(newDebt) || 0;

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
          <span>{safeOldDebt.toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Chi phí hôm nay</span>
          <span>{safeTotal.toLocaleString('vi-VN')}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 text-[11px] space-y-1">
        <div className="flex justify-between">
          <span className="font-semibold">Cần thanh toán:</span>
          <span>{(safeOldDebt + safeTotal).toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between text-[12px] font-bold mt-1">
          <span>Đã thanh toán:</span>
          <span>{safePaid.toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between mt-1 pt-1 border-t border-black border-dashed font-bold">
          <span>Công nợ còn lại:</span>
          <span>{safeNewDebt.toLocaleString('vi-VN')}</span>
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
