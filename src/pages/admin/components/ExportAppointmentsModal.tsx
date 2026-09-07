import React, { useState } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import api from '../../../services/api';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export default function ExportAppointmentsModal({ 
  onClose 
}: { 
  onClose: () => void 
}) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.get('/appointments', {
        params: {
          startDate,
          endDate,
          // Let's get all appointments within this range regardless of pagination
          limit: 1000
        }
      });

      if (res.data.success) {
        const data = res.data.data;
        if (data.length === 0) {
          setError('Không có dữ liệu trong khoảng thời gian này.');
          setLoading(false);
          return;
        }

        // Transform data for Excel
        const exportData = data.map((apt: any) => ({
          'Mã lịch hẹn': apt.id,
          'Tên khách hàng': apt.patientName,
          'Số điện thoại': apt.patientPhone,
          'Dịch vụ': apt.serviceName || 'Khám tổng quát',
          'Ngày hẹn': format(new Date(apt.startAt), 'dd/MM/yyyy'),
          'Giờ bắt đầu': format(new Date(apt.startAt), 'HH:mm'),
          'Giờ kết thúc': format(new Date(apt.endAt), 'HH:mm'),
          'Trạng thái': translateStatus(apt.status),
          'Ghi chú': apt.notes || '',
          'Nguồn': apt.source || 'ONLINE'
        }));

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch hẹn");

        // Set column widths
        const wscols = [
          {wch: 35}, // Mã
          {wch: 25}, // Tên
          {wch: 15}, // SĐT
          {wch: 30}, // Dịch vụ
          {wch: 15}, // Ngày hẹn
          {wch: 15}, // Bắt đầu
          {wch: 15}, // Kết thúc
          {wch: 20}, // Trạng thái
          {wch: 40}, // Ghi chú
          {wch: 15}, // Nguồn
        ];
        worksheet['!cols'] = wscols;

        // Generate filename
        const fileName = `LichHen_${startDate}_den_${endDate}.xlsx`;

        // Save file
        XLSX.writeFile(workbook, fileName);
        
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Có lỗi xảy ra khi xuất dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const translateStatus = (status: string) => {
    const STATUS_MAP: Record<string, string> = {
      'REQUESTED': 'Yêu cầu mới',
      'PENDING': 'Chờ xác nhận',
      'CONFIRMED': 'Đã xác nhận',
      'CHECKED_IN': 'Đã đến khám (Check-in)',
      'COMPLETED': 'Hoàn thành',
      'NO_SHOW': 'Không đến',
      'CANCELLED': 'Đã hủy',
      'CANCEL_PATIENT': 'Khách hàng hủy',
      'CANCEL_CLINIC': 'Phòng khám hủy'
    };
    return STATUS_MAP[status] || status;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>Xuất dữ liệu lịch hẹn</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleExport} className="p-5 space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Từ ngày</label>
              <Input 
                type="date" 
                required 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Đến ngày</label>
              <Input 
                type="date" 
                required 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>
          
          <p className="text-xs text-slate-500">
            Dữ liệu sẽ được xuất ra file Excel (.xlsx) gồm danh sách các lịch hẹn và trạng thái tương ứng trong khoảng thời gian đã chọn.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? (
                <>Đang xử lý...</>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Xuất ra Excel
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
