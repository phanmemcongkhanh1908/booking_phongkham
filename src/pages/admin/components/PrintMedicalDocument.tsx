import React from 'react';
import { format } from 'date-fns';
import { PrintReportConfig } from './AnalyticsPrintModal';

interface PrintMedicalDocumentProps {
  summary: any;
  serviceStats: any[];
  occupancyStats: any[];
  timeRange: '7' | '14' | '30' | 'all';
  clinicProfile: any;
  currentUser: any;
  printConfig?: PrintReportConfig;
}

const formatVND = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
};

const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN').format(value);
};

export default function PrintMedicalDocument({
  summary,
  serviceStats,
  occupancyStats,
  timeRange,
  clinicProfile,
  currentUser,
  printConfig,
}: PrintMedicalDocumentProps) {
  const rangeLabelMap: Record<string, string> = {
    '7': '7 ngày qua',
    '14': '14 ngày qua',
    '30': '30 ngày qua',
    'all': 'Toàn bộ thời gian tích lũy',
  };

  const clinicName = clinicProfile?.clinicName || 'NHA KHOA THẨM MỸ DENTAL SMART';
  const clinicAddress = clinicProfile?.address || 'Hệ thống phòng khám Nha khoa Thông minh';
  const clinicPhone = clinicProfile?.phone || '1900 6868';
  const reportCode = `BC-DS-${format(new Date(), 'yyyyMMdd-HHmm')}`;
  const printDateStr = format(new Date(), 'HH:mm - dd/MM/yyyy');

  // Values from config or defaults
  const reportTitle = printConfig?.reportTitle || 'BÁO CÁO TỔNG KẾT HOẠT ĐỘNG KHÁM CHỮA BỆNH & DOANH THU';
  const preparedByName = printConfig?.preparedByName || currentUser?.username || currentUser?.email || 'Quản trị viên';
  const preparedByRole = printConfig?.preparedByRole || (currentUser?.role === 'role-admin' || currentUser?.role === 'admin' ? 'Trưởng phòng Vận hành' : 'Nhân viên Tiếp đón');
  const directorName = printConfig?.directorName || clinicProfile?.doctorName || 'BS. Trưởng Phòng Khám';
  const evaluationNote = printConfig?.evaluationNote || (
    `• Tổng doanh thu đạt ${formatVND(summary?.totalRevenue)} với tỷ lệ hoàn tất khám đạt ${summary?.completionRate || 0}%.\n` +
    `• Dịch vụ ${(serviceStats && serviceStats[0]?.name) || 'Khám răng tổng quát'} đóng góp doanh thu nổi bật nhất.\n` +
    `• Tỷ lệ bệnh nhân tái khám đạt ${summary?.returningRate || 0}%, khuyến nghị duy trì hệ thống tự động nhắc hẹn lịch tái khám định kỳ.`
  );

  const showKpi = printConfig?.showKpi ?? true;
  const showServices = printConfig?.showServices ?? true;
  const showTimeline = printConfig?.showTimeline ?? true;
  const showNotes = printConfig?.showNotes ?? true;
  const showSignatures = printConfig?.showSignatures ?? true;

  return (
    <div className="hidden print:block bg-white text-slate-900 font-sans p-2 space-y-4 w-full">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-teal-800 text-white flex items-center justify-center font-black text-xl shrink-0">
            {clinicName.charAt(0)}
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight leading-tight">
              {clinicName}
            </h2>
            <p className="text-[11px] text-slate-700 font-medium mt-0.5">{clinicAddress}</p>
            <p className="text-[11px] text-slate-600">
              Hotline: <strong className="text-slate-900">{clinicPhone}</strong>
              {directorName && (
                <span> • Phụ trách chuyên môn: <strong>BS. {directorName}</strong></span>
              )}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-600 shrink-0 space-y-0.5">
          <p>Mã báo cáo: <strong className="text-slate-900">{reportCode}</strong></p>
          <p>Thời gian in: <strong>{printDateStr}</strong></p>
          <p>Kỳ báo cáo: <strong className="text-teal-900">{rangeLabelMap[timeRange] || 'Toàn kỳ'}</strong></p>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
          {reportTitle}
        </h1>
        <p className="text-slate-600 text-[11px] mt-0.5 italic">
          (Dữ liệu được chuẩn hóa và trích xuất trực tiếp từ hệ thống quản lý phòng khám)
        </p>
      </div>

      {/* Section I: KPI Grid */}
      {showKpi && (
        <div className="space-y-1.5 print-avoid-break">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-teal-800 pl-2">
            I. BẢNG TỔNG HỢP CHỈ SỐ ĐIỀU HÀNH & HIỆU SUẤT TÀI CHÍNH
          </h3>

          <div className="grid grid-cols-3 gap-2 border border-slate-400 rounded-lg p-2.5 bg-slate-50/40">
            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Tổng Doanh Thu</span>
              <span className="text-sm font-black text-emerald-800 block mt-0.5">
                {formatVND(summary?.totalRevenue)}
              </span>
              <span className="text-[10px] text-slate-600">{summary?.completedAppointments || 0} ca hoàn tất thu tiền</span>
            </div>

            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Tổng Lượt Hẹn Khám</span>
              <span className="text-sm font-black text-slate-900 block mt-0.5">
                {formatNumber(summary?.totalAppointments)} lượt
              </span>
              <span className="text-[10px] text-slate-600">Ghi nhận toàn hệ thống</span>
            </div>

            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Tỉ Lệ Hoàn Thành</span>
              <span className="text-sm font-black text-teal-800 block mt-0.5">
                {summary?.completionRate || 0}%
              </span>
              <span className="text-[10px] text-slate-600">{summary?.completedAppointments || 0} ca khám xong</span>
            </div>

            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Tỉ Lệ Hủy / Vắng</span>
              <span className="text-sm font-black text-rose-700 block mt-0.5">
                {summary?.cancellationRate || 0}%
              </span>
              <span className="text-[10px] text-slate-600">{summary?.cancelledAppointments || 0} ca đã hủy</span>
            </div>

            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Doanh Thu TB / Ca</span>
              <span className="text-sm font-black text-slate-900 block mt-0.5">
                {formatVND(summary?.avgTicket)}
              </span>
              <span className="text-[10px] text-slate-600">Giá trị bình quân / ca khám</span>
            </div>

            <div className="p-2 bg-white rounded border border-slate-300">
              <span className="text-[10px] text-slate-600 uppercase font-semibold block">Tái Khám (Retention)</span>
              <span className="text-sm font-black text-purple-900 block mt-0.5">
                {summary?.returningRate || 0}%
              </span>
              <span className="text-[10px] text-slate-600">{summary?.returningPatients || 0} / {summary?.totalPatients || 0} bệnh nhân quay lại</span>
            </div>
          </div>
        </div>
      )}

      {/* Section II: Services Performance Table */}
      {showServices && (
        <div className="space-y-1.5 print-avoid-break">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-teal-800 pl-2">
              II. BẢNG CHI TIẾT DOANH THU THEO TỪNG DỊCH VỤ NHA KHOA
            </h3>
            <span className="text-[10px] text-slate-600 font-medium">
              (Đơn vị tiền tệ: Việt Nam Đồng - VNĐ)
            </span>
          </div>

          <table className="w-full text-left border-collapse text-[11px] border border-slate-400 print-table">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-8">#</th>
                <th className="py-1.5 px-2.5 border-r border-slate-300">Tên Dịch Vụ Nha Khoa</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-16">Thời lượng</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-16">Số ca</th>
                <th className="py-1.5 px-2.5 text-right border-r border-slate-300 w-28">Doanh Thu (VNĐ)</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-300 w-16">Tỷ trọng</th>
                <th className="py-1.5 px-2 text-center w-24">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {(serviceStats || []).map((s, idx) => (
                <tr key={s.id || s.name}>
                  <td className="py-1 px-2 text-center border-r border-slate-300 text-slate-600">
                    {idx + 1}
                  </td>
                  <td className="py-1 px-2.5 border-r border-slate-300 font-semibold text-slate-900">
                    {s.name}
                  </td>
                  <td className="py-1 px-2 text-center border-r border-slate-300 text-slate-700">
                    {s.durationMins || 30}p
                  </td>
                  <td className="py-1 px-2 text-center border-r border-slate-300 font-bold text-slate-900">
                    {formatNumber(s.count)}
                  </td>
                  <td className="py-1 px-2.5 text-right border-r border-slate-300 font-bold text-slate-900">
                    {formatVND(s.revenue)}
                  </td>
                  <td className="py-1 px-2 text-center border-r border-slate-300 font-bold text-teal-900">
                    {s.percent || 0}%
                  </td>
                  <td className="py-1 px-2 text-center text-[10px]">
                    {idx === 0 && (s.revenue || 0) > 0 ? (
                      <span className="font-bold text-amber-900">Mũi nhọn</span>
                    ) : (s.revenue || 0) > 0 ? (
                      <span className="text-emerald-900">Doanh thu ổn định</span>
                    ) : (
                      <span className="text-slate-600">Khám tư vấn</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900">
                <td colSpan={3} className="py-1.5 px-2.5 text-right uppercase border-r border-slate-300">
                  Tổng cộng toàn bộ dịch vụ:
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-300">
                  {formatNumber(serviceStats?.reduce((a, b) => a + (b.count || 0), 0) || 0)} ca
                </td>
                <td className="py-1.5 px-2.5 text-right border-r border-slate-300 text-emerald-900 text-xs">
                  {formatVND(summary?.totalRevenue)}
                </td>
                <td className="py-1.5 px-2 text-center border-r border-slate-300 text-teal-900">100%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Section III: Recent timeline summary table */}
      {showTimeline && (occupancyStats || []).length > 0 && (
        <div className="space-y-1.5 print-avoid-break">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-teal-800 pl-2">
            III. THEO DÕI BIẾN ĐỘNG LỊCH KHÁM THEO MỐC THỜI GIAN
          </h3>
          <table className="w-full text-left border-collapse text-[10px] border border-slate-400 print-table">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                <th className="py-1 px-2 border-r border-slate-300">Ngày</th>
                <th className="py-1 px-2 text-center border-r border-slate-300">Tổng hẹn</th>
                <th className="py-1 px-2 text-center border-r border-slate-300">Hoàn thành</th>
                <th className="py-1 px-2 text-center border-r border-slate-300">Đã hủy</th>
                <th className="py-1 px-2 text-right">Doanh thu ngày (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {(occupancyStats || []).slice(0, 10).map((d) => (
                <tr key={d.date}>
                  <td className="py-1 px-2 border-r border-slate-300 font-semibold text-slate-900">{d.date}</td>
                  <td className="py-1 px-2 text-center border-r border-slate-300">{d.total}</td>
                  <td className="py-1 px-2 text-center border-r border-slate-300 text-emerald-900 font-bold">{d.completed}</td>
                  <td className="py-1 px-2 text-center border-r border-slate-300 text-rose-700">{d.cancelled}</td>
                  <td className="py-1 px-2 text-right font-semibold text-slate-900">{formatVND(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section IV: Executive Notes / Observations */}
      {showNotes && evaluationNote && (
        <div className="space-y-1 border border-slate-300 bg-slate-50/50 p-2.5 rounded-lg text-[11px] print-avoid-break">
          <h4 className="font-bold uppercase text-slate-900 text-[10px]">
            IV. NHẬN XÉT & ĐÁNH GIÁ CỦA BAN ĐIỀU HÀNH PHÒNG KHÁM
          </h4>
          <p className="text-slate-800 leading-relaxed whitespace-pre-line">
            {evaluationNote}
          </p>
        </div>
      )}

      {/* Section V: Triple Signatures */}
      {showSignatures && (
        <div className="pt-3 grid grid-cols-3 gap-4 text-center text-xs print-avoid-break">
          <div>
            <p className="font-bold text-slate-900 uppercase text-[11px]">Người lập báo cáo</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
            <div className="h-14 flex items-end justify-center">
              <span className="font-semibold text-slate-900">{preparedByName}</span>
            </div>
            <p className="text-[10px] text-slate-600">{preparedByRole}</p>
          </div>

          <div>
            <p className="font-bold text-slate-900 uppercase text-[11px]">Kế toán / Quản lý</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
            <div className="h-14 flex items-end justify-center">
              <span className="text-slate-500 italic text-[11px]">(Đã ký duyệt)</span>
            </div>
            <p className="text-[10px] text-slate-600">Phụ trách tài chính</p>
          </div>

          <div>
            <p className="font-bold text-slate-900 uppercase text-[11px]">Giám đốc phòng khám</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">(Ký tên & đóng dấu)</p>
            <div className="h-14 flex items-end justify-center">
              <span className="font-bold text-slate-900">{directorName}</span>
            </div>
            <p className="text-[10px] text-slate-600">Phụ trách chuyên môn</p>
          </div>
        </div>
      )}

      {/* Print Document Footer */}
      <div className="pt-2 border-t border-slate-300 text-center text-[9px] text-slate-500 flex items-center justify-between print-avoid-break">
        <span>Hệ thống Quản trị Nha khoa Dental Smart Cloud System</span>
        <span>Bảo mật dữ liệu Y tế & Tài chính • Trang 1/1</span>
      </div>
    </div>
  );
}
