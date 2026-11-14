import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Stethoscope,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import api from '../../../services/api';
import {
  APPOINTMENT_STATUSES,
  LABEL_OVERRIDES,
  STATUS_ALIASES,
} from '../../../constants/appointmentStatus';
import CustomerBookingHistoryModal, {
  BookingHistoryItem,
} from '../../../components/CustomerBookingHistoryModal';

interface HistoryTransaction extends BookingHistoryItem {
  patientId?: string;
  patientPhone?: string;
  servicePrice?: number;
  durationMins?: number;
  cancelReason?: string;
  rating?: number | null;
  reviewComment?: string;
  updatedAt?: string | null;
}

interface CustomerGroup {
  customerKey: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  totalTransactions: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  totalCompletedRevenue: number;
  latestAt: string;
  earliestAt: string;
  appointments: HistoryTransaction[];
}

interface HistorySummary {
  totalTransactions: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  completionRate: number;
  totalCompletedRevenue: number;
  uniqueCustomersCount: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEFAULT_SUMMARY: HistorySummary = {
  totalTransactions: 0,
  completedCount: 0,
  cancelledCount: 0,
  noShowCount: 0,
  completionRate: 0,
  totalCompletedRevenue: 0,
  uniqueCustomersCount: 0,
};

function formatVnd(amount?: number | null): string {
  const value = Number(amount) || 0;
  if (value <= 0) return '0 đ';
  return `${value.toLocaleString('vi-VN')} đ`;
}

function getStatusBadgeInfo(status: string) {
  const mappedKey = STATUS_ALIASES[status] || status;
  const config =
    APPOINTMENT_STATUSES[mappedKey as keyof typeof APPOINTMENT_STATUSES] ||
    APPOINTMENT_STATUSES.COMPLETED;
  const label = LABEL_OVERRIDES[status] || config.label || status;
  return { config, label };
}

export default function AppointmentHistoryView() {
  const [viewMode, setViewMode] = useState<'customers' | 'timeline'>('customers');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [summary, setSummary] = useState<HistorySummary>(DEFAULT_SUMMARY);
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit,
    totalPages: 1,
  });

  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [modalCustomer, setModalCustomer] = useState<{
    isOpen: boolean;
    name: string;
    phone: string;
    appointments: HistoryTransaction[];
  }>({
    isOpen: false,
    name: '',
    phone: '',
    appointments: [],
  });

  // Debounce search query cleanly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const applyDatePreset = (preset: 'all' | '7d' | '30d' | 'month') => {
    setDatePreset(preset);
    setPage(1);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '7d') {
      setStartDate(format(subDays(today, 6), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (preset === '30d') {
      setStartDate(format(subDays(today, 29), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    }
  };

  const resetFilters = () => {
    setStatusFilter('ALL');
    setSearchInput('');
    setDebouncedSearch('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
    setPage(1);
  };

  const buildQueryParams = useCallback(
    (overrideLimit?: number, includeCustomers = true) => {
      const params: Record<string, any> = {
        status: statusFilter,
        sort: sortOrder,
        page: overrideLimit === 0 ? 1 : page,
        limit: overrideLimit !== undefined ? overrideLimit : limit,
        includeCustomers: includeCustomers ? 'true' : 'false',
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      return params;
    },
    [statusFilter, sortOrder, page, limit, debouncedSearch, startDate, endDate]
  );

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/appointments/history', {
        params: buildQueryParams(limit, true),
      });
      if (res.data?.success) {
        setSummary(res.data.summary || DEFAULT_SUMMARY);
        setTransactions(Array.isArray(res.data.data) ? res.data.data : []);
        const groups: CustomerGroup[] = Array.isArray(res.data.customerGroups)
          ? res.data.customerGroups
          : [];
        setCustomerGroups(groups);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
        // Auto-expand first 2 customer cards so initial view immediately previews history details
        if (groups.length > 0) {
          setExpandedCustomers((prev) => {
            if (Object.keys(prev).length > 0) return prev;
            const initial: Record<string, boolean> = {};
            groups.slice(0, 2).forEach((g) => {
              initial[g.customerKey] = true;
            });
            return initial;
          });
        }
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Không thể tải dữ liệu lịch sử cuộc hẹn.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleCustomerExpand = (key: string) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await api.get('/appointments/history', {
        params: buildQueryParams(0, true),
      });
      const allTx: HistoryTransaction[] = Array.isArray(res.data?.data) ? res.data.data : [];
      const allGroups: CustomerGroup[] = Array.isArray(res.data?.customerGroups)
        ? res.data.customerGroups
        : [];

      if (allTx.length === 0) {
        toast.error('Không có dữ liệu lịch sử phù hợp để xuất file');
        return;
      }

      const txRows = allTx.map((item, idx) => {
        const dt = item.startAt ? new Date(item.startAt) : null;
        const valid = dt && !isNaN(dt.getTime());
        const { label } = getStatusBadgeInfo(item.status);
        const modeLabel = item.bookingFor === 'relative' ? 'Đặt hộ người thân' : 'Đặt cho chính mình';
        return {
          STT: idx + 1,
          'Ngày khám': valid ? format(dt, 'dd/MM/yyyy') : '',
          'Giờ hẹn': valid ? format(dt, 'HH:mm') : '',
          'Khách hàng': item.patientName || '',
          'Số điện thoại': item.patientPhone || '',
          'Hình thức đặt': modeLabel,
          'Người khám': item.bookedForName || item.patientName || '',
          'Dịch vụ': item.serviceName || '',
          'Giá trị (VNĐ)': Number(item.servicePrice) || 0,
          'Bác sĩ': item.providerName || '',
          'Trạng thái': label,
          'Lý do hủy / Ghi chú': item.cancelReason || item.notes || '',
          'Đánh giá (sao)': item.rating ? `${item.rating}/5` : '',
        };
      });

      const customerRows = allGroups.map((g, idx) => {
        const lastDt = g.latestAt ? new Date(g.latestAt) : null;
        return {
          STT: idx + 1,
          'Khách hàng': g.patientName,
          'Số điện thoại': g.patientPhone,
          'Tổng giao dịch': g.totalTransactions,
          'Đã hoàn thành': g.completedCount,
          'Đã hủy / Vắng': g.cancelledCount,
          'Doanh thu hoàn thành (VNĐ)': g.totalCompletedRevenue,
          'Lần gần nhất': lastDt && !isNaN(lastDt.getTime()) ? format(lastDt, 'HH:mm dd/MM/yyyy') : '',
        };
      });

      const wb = XLSX.utils.book_new();
      const wsTx = XLSX.utils.json_to_sheet(txRows);
      const wsCustomers = XLSX.utils.json_to_sheet(customerRows);
      XLSX.utils.book_append_sheet(wb, wsTx, 'LichSuGiaoDich');
      XLSX.utils.book_append_sheet(wb, wsCustomers, 'TongHopKhachHang');

      const fileName = `lich-su-cuoc-hen-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Đã xuất ${allTx.length} giao dịch ra file Excel`);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xuất file Excel');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return (
      statusFilter !== 'ALL' ||
      debouncedSearch.length > 0 ||
      Boolean(startDate) ||
      Boolean(endDate)
    );
  }, [statusFilter, debouncedSearch, startDate, endDate]);

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Lịch sử cuộc hẹn khách hàng
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi các lượt khám đã hoàn thành hoặc đã hủy của từng khách hàng theo thời gian
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || summary.totalTransactions === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 4-Card KPI Strip (Flat single-elevation with tabular-nums) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Đã hoàn thành</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums font-mono">
              {summary.completedCount}
            </span>
            <span className="text-xs font-semibold text-emerald-700 tabular-nums">
              {summary.completionRate}% hoàn tất
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            Trên tổng {summary.totalTransactions} giao dịch
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Đã hủy &amp; Vắng</span>
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-rose-700 tabular-nums font-mono">
              {summary.cancelledCount}
            </span>
            {summary.noShowCount > 0 && (
              <span className="text-xs font-medium text-amber-700 tabular-nums">
                {summary.noShowCount} vắng
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            Khách hủy, PK hủy &amp; không đến
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Khách hàng</span>
            <Users className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums font-mono">
              {summary.uniqueCustomersCount}
            </span>
            <span className="text-xs font-medium text-slate-500">hồ sơ</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Có giao dịch hoàn thành hoặc hủy
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Doanh thu hoàn thành</span>
            <Stethoscope className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-teal-700 tabular-nums font-mono truncate">
            {formatVnd(summary.totalCompletedRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tính trên các ca đã hoàn thành
          </p>
        </div>
      </div>

      {/* Filter & View Mode Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('customers')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'customers'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo khách hàng ({customerGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo dòng thời gian ({summary.totalTransactions})
              </button>
            </div>

            {/* Status Segmented Filter */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('COMPLETED');
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoàn thành ({summary.completedCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('CANCELLED');
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === 'CANCELLED'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã hủy ({summary.cancelledCount})
              </button>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 lg:max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm tên khách, SĐT, dịch vụ, bác sĩ..."
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                setPage(1);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl whitespace-nowrap cursor-pointer"
              title="Đổi thứ tự thời gian"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}</span>
            </button>
          </div>
        </div>

        {/* Date Presets & Custom Date Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Khoảng thời gian:
            </span>
            {[
              { id: 'all', label: 'Toàn bộ' },
              { id: '7d', label: '7 ngày qua' },
              { id: '30d', label: '30 ngày qua' },
              { id: 'month', label: 'Tháng này' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id as any)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="history-start-date" className="text-slate-500 font-medium">
                Từ
              </label>
              <input
                id="history-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="history-end-date" className="text-slate-500 font-medium">
                Đến
              </label>
              <input
                id="history-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Error / Loading Skeleton / Empty / Populated */}
      {errorMsg ? (
        <div className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Không tải được lịch sử cuộc hẹn</h3>
            <p className="text-xs text-slate-600 mt-1">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-48" />
                  <div className="h-3 bg-slate-100 rounded w-64" />
                </div>
                <div className="h-8 bg-slate-100 rounded-lg w-28" />
              </div>
              <div className="h-14 bg-slate-50 rounded-xl border border-slate-100" />
            </div>
          ))}
        </div>
      ) : summary.totalTransactions === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {hasActiveFilters
                ? 'Không tìm thấy giao dịch phù hợp với bộ lọc'
                : 'Chưa có lịch sử cuộc hẹn hoàn thành hoặc đã hủy'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Thử thay đổi từ khóa tìm kiếm, trạng thái hoặc nới rộng khoảng thời gian để xem lại dữ liệu.'
                : 'Khi các lịch hẹn được đánh dấu Hoàn thành hoặc Hủy, chi tiết giao dịch theo từng khách hàng sẽ tự động tổng hợp tại đây.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>
      ) : viewMode === 'customers' ? (
        /* VIEW 1: GROUPED PER CUSTOMER OVER TIME */
        <div className="space-y-3">
          {customerGroups.map((group) => {
            const isExpanded = !!expandedCustomers[group.customerKey];
            const lastDate = group.latestAt ? new Date(group.latestAt) : null;
            const lastDateLabel =
              lastDate && !isNaN(lastDate.getTime())
                ? format(lastDate, 'dd/MM/yyyy')
                : '—';

            return (
              <div
                key={group.customerKey}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
              >
                {/* Customer Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleCustomerExpand(group.customerKey)}
                    className="flex items-start sm:items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {group.patientName}
                        </span>
                        {group.patientPhone && (
                          <span className="text-xs font-mono tabular-nums text-slate-600">
                            {group.patientPhone}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                        <span>{group.totalTransactions} giao dịch</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-semibold">
                          {group.completedCount} hoàn thành
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-700 font-semibold">
                          {group.cancelledCount} đã hủy
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Gần nhất: {lastDateLabel}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="block text-[11px] text-slate-500">Tổng chi tiêu</span>
                      <span className="text-sm font-bold text-teal-700 tabular-nums font-mono">
                        {formatVnd(group.totalCompletedRevenue)}
                      </span>
                    </div>

                    {group.patientPhone && (
                      <a
                        href={`tel:${group.patientPhone}`}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title={`Gọi ${group.patientPhone}`}
                      >
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setModalCustomer({
                          isOpen: true,
                          name: group.patientName,
                          phone: group.patientPhone,
                          appointments: group.appointments,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Chi tiết</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Chronological Transactions for This Customer */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2.5">
                    {group.appointments.map((item) => {
                      const dt = item.startAt ? new Date(item.startAt) : null;
                      const validDt = dt && !isNaN(dt.getTime());
                      const { config, label } = getStatusBadgeInfo(item.status);
                      const isRelative = item.bookingFor === 'relative';
                      const isCompleted = item.status === 'COMPLETED';

                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-start justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 font-mono tabular-nums">
                                <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                {validDt
                                  ? `${format(dt, 'HH:mm')} · ${format(dt, 'dd/MM/yyyy')}`
                                  : 'Chưa rõ thời gian'}
                              </span>

                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                style={{
                                  backgroundColor: config.bg,
                                  color: config.color,
                                }}
                              >
                                {label}
                              </span>

                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                                {isRelative ? (
                                  <>
                                    <Users className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>Đặt hộ: {item.bookedForName}</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="w-3 h-3 text-teal-700 shrink-0" />
                                    <span>Đặt cho chính mình</span>
                                  </>
                                )}
                              </span>
                            </div>

                            <div className="text-xs text-slate-800 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-semibold text-slate-900">
                                {item.serviceName || 'Khám nha khoa'}
                              </span>
                              {item.providerName && (
                                <>
                                  <span className="text-slate-400" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-slate-600">BS. {item.providerName}</span>
                                </>
                              )}
                            </div>

                            {item.cancelReason && (
                              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                                <span className="font-semibold">Lý do hủy:</span> {item.cancelReason}
                              </div>
                            )}

                            {(item.notes || (item.rating && item.rating > 0)) && (
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                                {item.rating && item.rating > 0 && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                    {item.rating}/5
                                    {item.reviewComment && (
                                      <span className="font-normal text-slate-600">
                                        — &ldquo;{item.reviewComment}&rdquo;
                                      </span>
                                    )}
                                  </span>
                                )}
                                {item.notes && (
                                  <span className="inline-flex items-start gap-1 text-slate-500">
                                    <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{item.notes}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex md:flex-col items-center md:items-end justify-between gap-1 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                            <span
                              className={`text-sm font-bold tabular-nums font-mono ${
                                isCompleted ? 'text-teal-700' : 'text-slate-400 line-through'
                              }`}
                            >
                              {formatVnd(item.servicePrice)}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              #{String(item.id).slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: FLAT CHRONOLOGICAL LEDGER */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Mobile Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {transactions.map((item) => {
              const dt = item.startAt ? new Date(item.startAt) : null;
              const validDt = dt && !isNaN(dt.getTime());
              const { config, label } = getStatusBadgeInfo(item.status);
              const isCompleted = item.status === 'COMPLETED';
              return (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{item.patientName}</p>
                      <p className="text-xs font-mono tabular-nums text-slate-500">
                        {item.patientPhone || '—'}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0"
                      style={{ backgroundColor: config.bg, color: config.color }}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-medium">
                    {item.serviceName}
                    {item.providerName ? ` · BS. ${item.providerName}` : ''}
                  </div>

                  {item.cancelReason && (
                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                      Lý do hủy: {item.cancelReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono tabular-nums text-slate-600">
                      {validDt ? `${format(dt, 'HH:mm · dd/MM/yyyy')}` : '—'}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-bold ${
                        isCompleted ? 'text-teal-700' : 'text-slate-400 line-through'
                      }`}
                    >
                      {formatVnd(item.servicePrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 min-w-[780px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Dịch vụ &amp; Bác sĩ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Giá trị</th>
                  <th className="px-4 py-3">Ghi chú / Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((item) => {
                  const dt = item.startAt ? new Date(item.startAt) : null;
                  const validDt = dt && !isNaN(dt.getTime());
                  const { config, label } = getStatusBadgeInfo(item.status);
                  const isCompleted = item.status === 'COMPLETED';
                  const isRelative = item.bookingFor === 'relative';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {validDt ? format(dt, 'HH:mm') : '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {validDt ? format(dt, 'dd/MM/yyyy') : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.patientName}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {item.patientPhone || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {isRelative ? `Đặt hộ: ${item.bookedForName}` : 'Đặt cho chính mình'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.serviceName}</div>
                        {item.providerName && (
                          <div className="text-[11px] text-slate-500">BS. {item.providerName}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {label}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold">
                        <span className={isCompleted ? 'text-teal-700' : 'text-slate-400 line-through'}>
                          {formatVnd(item.servicePrice)}
                        </span>
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        {item.cancelReason ? (
                          <span className="text-rose-700 font-medium">{item.cancelReason}</span>
                        ) : item.rating ? (
                          <span className="text-amber-700 font-semibold">
                            {item.rating}/5★{item.reviewComment ? ` — ${item.reviewComment}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500">{item.notes || '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
              <span className="text-slate-600 tabular-nums">
                Trang <strong className="text-slate-900">{pagination.page}</strong> /{' '}
                <strong className="text-slate-900">{pagination.totalPages}</strong> (Tổng{' '}
                {pagination.total} giao dịch)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Trang trước
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popup Detail Modal for Individual Customer */}
      <CustomerBookingHistoryModal
        isOpen={modalCustomer.isOpen}
        onClose={() =>
          setModalCustomer({ isOpen: false, name: '', phone: '', appointments: [] })
        }
        customerName={modalCustomer.name}
        customerPhone={modalCustomer.phone}
        appointments={modalCustomer.appointments}
      />
    </div>
  );
}
