import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Printer, 
  X, 
  Download, 
  CheckCircle2, 
  FileText, 
  Calendar,
  Layers,
  Settings2,
  ChevronRight,
  Eye,
  Check
} from 'lucide-react';

export interface PrintReportConfig {
  reportTitle: string;
  preparedByName: string;
  preparedByRole: string;
  directorName: string;
  evaluationNote: string;
  showKpi: boolean;
  showServices: boolean;
  showTimeline: boolean;
  showNotes: boolean;
  showSignatures: boolean;
}

interface AnalyticsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: any;
  serviceStats: any[];
  occupancyStats: any[];
  timeRange: '7' | '14' | '30' | 'all';
  clinicProfile: any;
  currentUser: any;
  onExportExcel?: () => void;
  printConfig?: PrintReportConfig;
  onUpdateConfig?: (config: PrintReportConfig) => void;
}

const formatVND = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
};

const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN').format(value);
};

export default function AnalyticsPrintModal({
  isOpen,
  onClose,
  summary,
  serviceStats,
  occupancyStats,
  timeRange,
  clinicProfile,
  currentUser,
  onExportExcel,
  printConfig: externalConfig,
  onUpdateConfig,
}: AnalyticsPrintModalProps) {
  // Mobile active tab: 'preview' (bản in) | 'config' (cấu hình)
  const [activeTab, setActiveTab] = useState<'preview' | 'config'>('preview');
  
  // Desktop sidebar collapse toggle
  const [showDesktopConfig, setShowDesktopConfig] = useState(true);

  // Reference for the preview scroll container (to guarantee top = 0 on open)
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // Local state for configuration
  const [config, setConfig] = useState<PrintReportConfig>(() => ({
    reportTitle: externalConfig?.reportTitle || 'BÁO CÁO TỔNG KẾT HOẠT ĐỘNG KHÁM CHỮA BỆNH & DOANH THU',
    preparedByName: externalConfig?.preparedByName || currentUser?.username || currentUser?.email || 'Quản trị viên',
    preparedByRole: externalConfig?.preparedByRole || (currentUser?.role === 'role-admin' || currentUser?.role === 'admin' ? 'Trưởng phòng Vận hành' : 'Nhân viên Tiếp đón'),
    directorName: externalConfig?.directorName || clinicProfile?.doctorName || 'BS. Trưởng Phòng Khám',
    evaluationNote: externalConfig?.evaluationNote || (
      `1. Tổng doanh thu đạt ${formatVND(summary?.totalRevenue)} với tỷ lệ hoàn tất khám đạt ${summary?.completionRate || 0}%.\n` +
      `2. Dịch vụ chủ lực: ${(serviceStats && serviceStats[0]?.name) || 'Khám răng tổng quát'} đóng góp doanh thu nổi bật nhất.\n` +
      `3. Tỷ lệ bệnh nhân tái khám đạt ${summary?.returningRate || 0}%, cần duy trì gửi tin nhắn nhắc lịch tái khám tự động qua hệ thống.`
    ),
    showKpi: externalConfig?.showKpi ?? true,
    showServices: externalConfig?.showServices ?? true,
    showTimeline: externalConfig?.showTimeline ?? true,
    showNotes: externalConfig?.showNotes ?? true,
    showSignatures: externalConfig?.showSignatures ?? true,
  }));

  // Sync back to parent if provided
  const updateConfig = (newConfig: Partial<PrintReportConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      if (onUpdateConfig) onUpdateConfig(updated);
      return updated;
    });
  };

  // Reset scroll to top when modal opens or tab switches
  useEffect(() => {
    if (isOpen) {
      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

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

  const handleExecutePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4 md:p-6 overflow-hidden print:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full h-full sm:h-auto sm:max-h-[94vh] sm:max-w-6xl flex flex-col bg-slate-100 sm:rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden animate-in fade-in duration-200">
        
        {/* =========================================================================
            TOP NAVBAR: Responsive layout for both Mobile and PC (Zero overlapping)
            ========================================================================= */}
        <header className="bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Branding & Modal Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-white truncate">
                    Bản In Báo Cáo Y Khoa (A4)
                  </h2>
                  <span className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-semibold bg-teal-500/20 text-teal-300 rounded-full border border-teal-500/30">
                    Chuẩn Y Tế
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block truncate">
                  Tự động phân trang • Số liệu chuẩn hóa có phân cách hàng nghìn • Sẵn sàng in hoặc xuất PDF
                </p>
              </div>
            </div>

            {/* Right: Desktop Controls & Close Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Desktop Toggle Config Sidebar Button */}
              <button
                type="button"
                onClick={() => setShowDesktopConfig(!showDesktopConfig)}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                title={showDesktopConfig ? 'Ẩn bảng tùy chỉnh' : 'Hiện bảng tùy chỉnh'}
              >
                <Settings2 className="w-3.5 h-3.5 text-teal-400" />
                <span>{showDesktopConfig ? 'Thu gọn cài đặt' : 'Tùy chỉnh nội dung'}</span>
              </button>

              {/* Desktop Excel Export */}
              {onExportExcel && (
                <button
                  type="button"
                  onClick={onExportExcel}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                  title="Xuất dữ liệu thô sang Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Excel</span>
                </button>
              )}

              {/* Primary Print / Save PDF Button (Desktop) */}
              <button
                type="button"
                onClick={handleExecutePrint}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>In Ngay (A4) / Lưu PDF</span>
              </button>

              {/* Close Modal Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Đóng bản xem trước"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Segmented Tab Controller */}
          <div className="flex sm:hidden mt-2.5 p-0.5 bg-slate-800/90 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'preview'
                  ? 'bg-teal-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem Bản In A4</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'config'
                  ? 'bg-teal-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Tùy Chỉnh Thông Tin</span>
            </button>
          </div>
        </header>

        {/* =========================================================================
            MAIN MODAL CONTENT: Split or Full Screen depending on Mobile / PC
            ========================================================================= */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* 1. CONFIGURATION SIDEBAR (Visible on Desktop if toggled, or on Mobile if activeTab === 'config') */}
          <aside 
            className={`bg-white border-r border-slate-200 overflow-y-auto space-y-4 p-4 sm:p-5 text-xs z-10 transition-all ${
              activeTab === 'config' 
                ? 'w-full flex flex-col absolute inset-0 sm:relative sm:w-80' 
                : showDesktopConfig 
                  ? 'hidden lg:block lg:w-80 lg:shrink-0' 
                  : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Thông tin bản in
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Khổ A4 Y tế</span>
            </div>

            {/* Title field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tiêu đề báo cáo
              </label>
              <input
                type="text"
                value={config.reportTitle || ''}
                onChange={(e) => updateConfig({ reportTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Tiêu đề báo cáo"
              />
            </div>

            {/* Author & Role */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Người lập biểu</label>
                <input
                  type="text"
                  value={config.preparedByName || ''}
                  onChange={(e) => updateConfig({ preparedByName: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chức vụ</label>
                <input
                  type="text"
                  value={config.preparedByRole || ''}
                  onChange={(e) => updateConfig({ preparedByRole: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Director / Doctor */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bác sĩ / Giám đốc phòng khám</label>
              <input
                type="text"
                value={config.directorName || ''}
                onChange={(e) => updateConfig({ directorName: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
              />
            </div>

            {/* Evaluation note */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nhận xét & Kết luận điều hành
              </label>
              <textarea
                rows={3}
                value={config.evaluationNote || ''}
                onChange={(e) => updateConfig({ evaluationNote: e.target.value })}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Nhập nhận xét hoặc kết luận chuyên môn..."
              />
            </div>

            {/* Toggle Sections */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-1">
                Bật / Tắt các mục bản in:
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showKpi}
                  onChange={(e) => updateConfig({ showKpi: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>I. Bảng tổng hợp KPI tài chính</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showServices}
                  onChange={(e) => updateConfig({ showServices: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>II. Chi tiết doanh thu theo dịch vụ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showTimeline}
                  onChange={(e) => updateConfig({ showTimeline: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>III. Theo dõi lịch khám theo ngày</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showNotes}
                  onChange={(e) => updateConfig({ showNotes: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>IV. Nhận xét ban điều hành</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={config.showSignatures}
                  onChange={(e) => updateConfig({ showSignatures: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>V. Chữ ký xác nhận 3 bên</span>
              </label>
            </div>

            {/* Quick Tips */}
            <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl space-y-1 text-teal-900 text-[11px]">
              <div className="font-bold flex items-center gap-1 text-teal-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                Mẹo in chuẩn A4 y tế
              </div>
              <p className="text-teal-700 leading-snug">
                • Trong hộp thoại in, chọn khổ <strong>A4</strong>, tỷ lệ <strong>Mặc định (100%)</strong>.
              </p>
              <p className="text-teal-700 leading-snug">
                • Bật tùy chọn <strong>Đồ họa nền (Background graphics)</strong> để giữ viền bảng rõ nét.
              </p>
            </div>

            {/* Mobile "Switch to preview" button at bottom of config */}
            <div className="sm:hidden pt-3 border-t border-slate-200 mt-auto">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="w-full py-2.5 px-4 bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <Eye className="w-4 h-4" />
                <span>Xem lại bản in A4</span>
              </button>
            </div>
          </aside>

          {/* 2. A4 PAPER DOCUMENT PREVIEW (Guaranteed to start at scroll top: 0, no cutting off!) */}
          <main 
            ref={previewScrollRef}
            className={`flex-1 overflow-y-auto bg-slate-200/90 p-2 sm:p-5 lg:p-8 flex flex-col items-center justify-start ${
              activeTab === 'config' ? 'hidden sm:flex' : 'flex'
            }`}
          >
            {/* The Actual A4 Sheet Mockup */}
            <div className="w-full max-w-[820px] bg-white text-slate-900 shadow-xl sm:border border-slate-300 rounded-sm p-4 sm:p-8 md:p-10 space-y-5 text-xs font-sans my-0">
              
              {/* Document Header: Responsive flex that never crushes text into single columns */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b-2 border-slate-900 pb-3.5 gap-3">
                
                {/* Left: Clinic Branding & Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                    {clinicName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-xs sm:text-sm md:text-base text-slate-900 uppercase tracking-tight leading-snug break-words">
                      {clinicName}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium mt-0.5 leading-snug">
                      {clinicAddress}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                      Hotline: <strong className="text-slate-800 font-semibold">{clinicPhone}</strong>
                      {clinicProfile?.doctorName && (
                        <span className="hidden sm:inline"> • Phụ trách chuyên môn: <strong className="text-slate-800 font-semibold">BS. {clinicProfile.doctorName}</strong></span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Official Document Metadata */}
                <div className="text-left sm:text-right text-[10px] sm:text-[11px] text-slate-500 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 sm:space-y-0.5">
                  <p className="flex items-center sm:justify-end gap-1.5">
                    <span className="text-slate-400">Mã báo cáo:</span>
                    <strong className="text-slate-800 font-mono font-semibold">{reportCode}</strong>
                  </p>
                  <p className="flex items-center sm:justify-end gap-1.5">
                    <span className="text-slate-400">Thời gian in:</span>
                    <strong className="text-slate-700">{printDateStr}</strong>
                  </p>
                  <p className="flex items-center sm:justify-end gap-1.5">
                    <span className="text-slate-400">Kỳ báo cáo:</span>
                    <strong className="text-teal-700 font-semibold">{rangeLabelMap[timeRange] || 'Toàn kỳ'}</strong>
                  </p>
                </div>
              </div>

              {/* Title of Document */}
              <div className="text-center pt-1 pb-1">
                <h1 className="text-sm sm:text-base md:text-lg font-black uppercase text-slate-900 tracking-wide">
                  {config.reportTitle}
                </h1>
                <p className="text-slate-500 text-[10px] sm:text-[11px] mt-0.5 italic">
                  (Dữ liệu được chuẩn hóa và trích xuất tự động từ hệ thống hồ sơ tiếp đón bệnh nhân)
                </p>
              </div>

              {/* Section I: KPI Summary Grid */}
              {config.showKpi && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-l-4 border-teal-700 pl-2">
                    I. BẢNG TỔNG HỢP CHỈ SỐ VẬN HÀNH & HIỆU QUẢ KINH DOANH
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-300 rounded-lg p-2.5 bg-slate-50/60">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Tổng Doanh Thu</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5">
                        {formatVND(summary?.totalRevenue)}
                      </span>
                      <span className="text-[10px] text-slate-500">{summary?.completedAppointments || 0} ca thu tiền</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Tổng Lượt Hẹn Khám</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                        {formatNumber(summary?.totalAppointments)} lượt
                      </span>
                      <span className="text-[10px] text-slate-500">Toàn hệ thống</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Tỉ Lệ Hoàn Thành</span>
                      <span className="text-xs sm:text-sm font-black text-teal-700 block mt-0.5">
                        {summary?.completionRate || 0}%
                      </span>
                      <span className="text-[10px] text-slate-500">{summary?.completedAppointments || 0} ca khám xong</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Tỉ Lệ Hủy / Vắng</span>
                      <span className="text-xs sm:text-sm font-black text-rose-600 block mt-0.5">
                        {summary?.cancellationRate || 0}%
                      </span>
                      <span className="text-[10px] text-slate-500">{summary?.cancelledAppointments || 0} ca đã hủy</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Doanh Thu TB / Ca</span>
                      <span className="text-xs sm:text-sm font-black text-slate-800 block mt-0.5">
                        {formatVND(summary?.avgTicket)}
                      </span>
                      <span className="text-[10px] text-slate-500">Giá trị bình quân</span>
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Bệnh Nhân Tái Khám</span>
                      <span className="text-xs sm:text-sm font-black text-purple-700 block mt-0.5">
                        {summary?.returningRate || 0}%
                      </span>
                      <span className="text-[10px] text-slate-500">{summary?.returningPatients || 0} / {summary?.totalPatients || 0} người</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Section II: Dental Services Table */}
              {config.showServices && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-l-4 border-teal-700 pl-2">
                      II. BẢNG CHI TIẾT DOANH THU THEO TỪNG DỊCH VỤ NHA KHOA
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                      (Đơn vị tiền tệ: VNĐ)
                    </span>
                  </div>

                  <div className="overflow-x-auto w-full border border-slate-300 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px] min-w-[500px] sm:min-w-full">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                          <th className="py-2 px-2 text-center border-r border-slate-300 w-8">#</th>
                          <th className="py-2 px-2.5 border-r border-slate-300">Tên Dịch Vụ Nha Khoa</th>
                          <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Thời lượng</th>
                          <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Số ca</th>
                          <th className="py-2 px-2.5 text-right border-r border-slate-300 w-28">Doanh Thu (VNĐ)</th>
                          <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Tỷ trọng</th>
                          <th className="py-2 px-2 text-center w-24">Phân loại</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(serviceStats || []).map((s, idx) => (
                          <tr key={s.id || s.name} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 text-center border-r border-slate-200 text-slate-500 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-slate-200 font-semibold text-slate-900">
                              {s.name}
                            </td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-200 text-slate-600">
                              {s.durationMins || 30} phút
                            </td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-200 font-bold text-slate-800">
                              {formatNumber(s.count)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right border-r border-slate-200 font-bold text-slate-900">
                              {formatVND(s.revenue)}
                            </td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-200 font-semibold text-teal-800">
                              {s.percent || 0}%
                            </td>
                            <td className="py-1.5 px-2 text-center text-[10px]">
                              {idx === 0 && (s.revenue || 0) > 0 ? (
                                <span className="font-bold text-amber-700">Mũi nhọn</span>
                              ) : (s.revenue || 0) > 0 ? (
                                <span className="text-emerald-700 font-medium">Doanh thu ổn định</span>
                              ) : (
                                <span className="text-slate-500">Khám tư vấn</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-800 text-slate-900">
                          <td colSpan={3} className="py-2 px-2.5 text-right uppercase border-r border-slate-300">
                            Tổng cộng toàn bộ dịch vụ:
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-300">
                            {formatNumber(serviceStats?.reduce((a, b) => a + (b.count || 0), 0) || 0)} ca
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-slate-300 text-emerald-800 text-xs">
                            {formatVND(summary?.totalRevenue)}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-300 text-teal-800">100%</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Section III: Timeline Table */}
              {config.showTimeline && (occupancyStats || []).length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-l-4 border-teal-700 pl-2">
                    III. THEO DÕI LỊCH KHÁM THEO MỐC THỜI GIAN
                  </h4>
                  <div className="overflow-x-auto w-full border border-slate-300 rounded-lg">
                    <table className="w-full text-left border-collapse text-[10px] min-w-[420px] sm:min-w-full">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                          <th className="py-1.5 px-2 border-r border-slate-300">Ngày</th>
                          <th className="py-1.5 px-2 text-center border-r border-slate-300">Tổng hẹn</th>
                          <th className="py-1.5 px-2 text-center border-r border-slate-300">Hoàn thành</th>
                          <th className="py-1.5 px-2 text-center border-r border-slate-300">Đã hủy</th>
                          <th className="py-1.5 px-2 text-right">Doanh thu ngày (VNĐ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(occupancyStats || []).slice(0, 7).map((d) => (
                          <tr key={d.date} className="hover:bg-slate-50">
                            <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-800">{d.date}</td>
                            <td className="py-1 px-2 text-center border-r border-slate-200">{d.total}</td>
                            <td className="py-1 px-2 text-center border-r border-slate-200 text-emerald-700 font-bold">{d.completed}</td>
                            <td className="py-1 px-2 text-center border-r border-slate-200 text-rose-600">{d.cancelled}</td>
                            <td className="py-1 px-2 text-right font-semibold text-slate-900">{formatVND(d.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section IV: Executive Notes / Observations */}
              {config.showNotes && config.evaluationNote && (
                <div className="space-y-1 border border-slate-200 bg-slate-50/70 p-3 rounded-lg text-[11px]">
                  <h4 className="font-extrabold uppercase text-slate-800 text-[10px]">
                    IV. NHẬN XÉT & ĐÁNH GIÁ CỦA BAN ĐIỀU HÀNH PHÒNG KHÁM
                  </h4>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {config.evaluationNote}
                  </p>
                </div>
              )}

              {/* Section V: Triple Signatures */}
              {config.showSignatures && (
                <div className="pt-4 grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 uppercase text-[10px] sm:text-[11px]">Người lập báo cáo</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-12 sm:h-16 flex items-end justify-center">
                      <span className="font-semibold text-slate-800">{config.preparedByName}</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-500">{config.preparedByRole}</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 uppercase text-[10px] sm:text-[11px]">Kế toán / Quản lý</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-12 sm:h-16 flex items-end justify-center">
                      <span className="text-slate-400 italic text-[10px] sm:text-[11px]">(Đã duyệt điện tử)</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-500">Phụ trách tài chính</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 uppercase text-[10px] sm:text-[11px]">Giám đốc phòng khám</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 italic mt-0.5">(Ký tên & đóng dấu)</p>
                    <div className="h-12 sm:h-16 flex items-end justify-center">
                      <span className="font-bold text-slate-900">{config.directorName}</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-500">Phụ trách chuyên môn</p>
                  </div>
                </div>
              )}

              {/* Print Document Footer Note */}
              <div className="pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400 flex items-center justify-between">
                <span>Hệ thống Quản trị Nha khoa Dental Smart Cloud System</span>
                <span>Bảo mật dữ liệu Y tế & Tài chính • Trang 1/1</span>
              </div>
            </div>
          </main>
        </div>

        {/* =========================================================================
            STICKY ACTION FOOTER ON MOBILE (No overlapping, thumb-friendly)
            ========================================================================= */}
        <div className="sm:hidden p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-300"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExecutePrint}
            className="flex-2 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>In Ngay / Lưu PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
}
