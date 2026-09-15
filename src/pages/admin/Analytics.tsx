import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  AreaChart, Area
} from 'recharts';
import api from '../../services/api';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { fetchDriveQuota, formatBytes, DriveQuota } from '../../lib/googleWorkspace';
import { useAuthStore } from '../../store/auth';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  DollarSign,
  CalendarCheck,
  Users,
  Activity,
  RefreshCw,
  Download,
  Printer,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart as PieIcon,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Award,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import AnalyticsPrintModal, { PrintReportConfig } from './components/AnalyticsPrintModal';
import PrintMedicalDocument from './components/PrintMedicalDocument';

// Harmonic, high-contrast modern palette
const SERVICE_COLORS = [
  '#059669', // Emerald
  '#2563eb', // Royal Blue
  '#7c3aed', // Purple
  '#d97706', // Amber
  '#0891b2', // Cyan
  '#dc2626', // Red
  '#db2777', // Pink
  '#4f46e5', // Indigo
];

const RETENTION_COLORS = ['#7c3aed', '#cbd5e1']; // Purple for returning, Slate-300 for first-time

interface AnalyticsData {
  summary?: {
    totalRevenue: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    pendingAppointments: number;
    confirmedAppointments: number;
    completionRate: number;
    cancellationRate: number;
    avgTicket: number;
    totalPatients: number;
    returningPatients: number;
    returningRate: number;
    todayAppointments: number;
    todayRevenue: number;
  };
  serviceStats: Array<{
    id?: string;
    name: string;
    count: number;
    revenue: number;
    percent?: number;
    durationMins?: number;
  }>;
  occupancyStats: Array<{
    date: string;
    completed: number;
    cancelled: number;
    pending?: number;
    total: number;
    revenue: number;
  }>;
  appointmentsByDay?: Array<{ date: string; count: number }>;
  appointmentsByWeek?: Array<{ week: string; count: number }>;
  statusBreakdown?: Array<{ status: string; label: string; count: number; color: string }>;
  returningRate?: number;
  totalPatients?: number;
  returningPatients?: number;
}

// Formatters
const formatVND = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
};

const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN').format(value);
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({
    serviceStats: [],
    occupancyStats: [],
    appointmentsByDay: [],
    appointmentsByWeek: [],
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'revenue' | 'appointments' | 'services'>('all');
  const [chartViewMode, setChartViewMode] = useState<'day' | 'week'>('day');

  // Print & Mobile Responsive States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintReportConfig | undefined>(undefined);
  const [clinicProfile, setClinicProfile] = useState<any>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [serviceViewMode, setServiceViewMode] = useState<'cards' | 'table'>('cards');

  const user = useAuthStore(state => state.user);
  const { isConnected, accessToken } = useGoogleAuthStore();
  const [driveQuota, setDriveQuota] = useState<DriveQuota | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect mobile screen and adjust view mode
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setServiceViewMode('cards');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch clinic profile for official print metadata
  useEffect(() => {
    api.get('/admin/settings').then(res => {
      if (res.data?.data?.clinicProfile) {
        setClinicProfile(res.data.data.clinicProfile);
      }
    }).catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await api.get('/admin/analytics', {
        params: { range: timeRange }
      });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setLastUpdated(new Date());
        if (isManual) {
          toast.success('Dữ liệu báo cáo đã được cập nhật thời gian thực', { id: 'analytics-refresh' });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', err);
      if (isManual) toast.error('Không thể cập nhật báo cáo');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [timeRange]);

  // Initial load and range change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchAnalytics();
      }, 30000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, fetchAnalytics]);

  // Google Drive Quota
  useEffect(() => {
    if (isConnected && accessToken) {
      fetchDriveQuota(accessToken).then(quota => {
        if (quota) {
          setDriveQuota(quota);
          if (quota.limit && quota.usage) {
            const limitNum = Number(quota.limit);
            const usedNum = Number(quota.usage);
            if (limitNum > 0) {
              const percent = Math.round((usedNum / limitNum) * 100);
              if (percent > 80) {
                const lastAlertStr = localStorage.getItem('lastStorageAlert_' + user?.id);
                const lastAlert = lastAlertStr ? parseInt(lastAlertStr) : 0;
                const now = Date.now();
                if (now - lastAlert > 7 * 24 * 60 * 60 * 1000) {
                  api.post('/admin/storage-alert', {
                    usedPercent: percent,
                    driveLink: 'https://drive.google.com/settings/storage'
                  }).then(() => {
                    localStorage.setItem('lastStorageAlert_' + user?.id, now.toString());
                  }).catch(console.error);
                }
              }
            }
          }
        }
      }).catch(console.error);
    }
  }, [isConnected, accessToken, user?.id]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: KPIs
      const summaryRows = [
        { 'Chỉ số': 'Tổng doanh thu', 'Giá trị': formatVND(summary.totalRevenue) },
        { 'Chỉ số': 'Tổng lịch hẹn', 'Giá trị': summary.totalAppointments },
        { 'Chỉ số': 'Lịch khám hoàn thành', 'Giá trị': summary.completedAppointments },
        { 'Chỉ số': 'Lịch khám đã hủy / Vắng mặt', 'Giá trị': summary.cancelledAppointments },
        { 'Chỉ số': 'Tỉ lệ hoàn thành', 'Giá trị': `${summary.completionRate}%` },
        { 'Chỉ số': 'Doanh thu trung bình / ca', 'Giá trị': formatVND(summary.avgTicket) },
        { 'Chỉ số': 'Tổng bệnh nhân', 'Giá trị': summary.totalPatients },
        { 'Chỉ số': 'Bệnh nhân quay lại', 'Giá trị': summary.returningPatients },
        { 'Chỉ số': 'Tỷ lệ khách quay lại', 'Giá trị': `${summary.returningRate}%` },
        { 'Chỉ số': 'Thời điểm xuất báo cáo', 'Giá trị': format(new Date(), 'HH:mm:ss dd/MM/yyyy') },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan chỉ số');

      // Sheet 2: Service Stats
      const serviceRows = (data.serviceStats || []).map((s, idx) => ({
        'STT': idx + 1,
        'Tên dịch vụ y tế': s.name,
        'Thời lượng': `${s.durationMins || 30} phút`,
        'Số ca tiếp nhận': s.count,
        'Tổng doanh thu (VNĐ)': s.revenue,
        'Tỷ trọng doanh thu (%)': `${s.percent || 0}%`,
      }));
      const wsServices = XLSX.utils.json_to_sheet(serviceRows);
      XLSX.utils.book_append_sheet(wb, wsServices, 'Doanh thu Dịch vụ');

      // Sheet 3: Daily Timeline
      const timelineRows = (data.occupancyStats || []).map(d => ({
        'Ngày': d.date,
        'Tổng lịch hẹn': d.total,
        'Hoàn thành': d.completed,
        'Đã hủy': d.cancelled,
        'Doanh thu (VNĐ)': d.revenue,
      }));
      const wsTimeline = XLSX.utils.json_to_sheet(timelineRows);
      XLSX.utils.book_append_sheet(wb, wsTimeline, 'Biến động theo ngày');

      const fileName = `Bao_Cao_Nha_Khoa_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Đã xuất báo cáo Excel thành công: ${fileName}`);
    } catch (err) {
      console.error('Xuất Excel lỗi:', err);
      toast.error('Có lỗi xảy ra khi xuất file Excel');
    }
  };

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  // Data derivations
  const summary = data.summary || {
    totalRevenue: data.serviceStats?.reduce((acc, cur) => acc + (cur.revenue || 0), 0) || 0,
    totalAppointments: data.occupancyStats?.reduce((acc, cur) => acc + (cur.total || 0), 0) || 0,
    completedAppointments: data.occupancyStats?.reduce((acc, cur) => acc + (cur.completed || 0), 0) || 0,
    cancelledAppointments: data.occupancyStats?.reduce((acc, cur) => acc + (cur.cancelled || 0), 0) || 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    completionRate: 0,
    cancellationRate: 0,
    avgTicket: 0,
    totalPatients: data.totalPatients || 0,
    returningPatients: data.returningPatients || 0,
    returningRate: data.returningRate || 0,
    todayAppointments: 0,
    todayRevenue: 0,
  };

  // Pie Data with clean formatting
  const pieData = (data.serviceStats || [])
    .filter(item => Number(item.revenue) > 0)
    .map(item => ({
      name: item.name,
      value: Number(item.revenue),
      count: item.count,
      percent: item.percent || (summary.totalRevenue > 0 ? Math.round((Number(item.revenue) / summary.totalRevenue) * 100) : 0),
    }));

  // Daily revenue and occupancy
  const timelineData = (data.occupancyStats || []).map(item => {
    let dateLabel = item.date;
    try {
      dateLabel = format(parseISO(item.date), 'dd/MM', { locale: vi });
    } catch {
      // keep original string
    }
    return {
      rawDate: item.date,
      date: dateLabel,
      'Hoàn thành': Number(item.completed) || 0,
      'Hủy/Bỏ hẹn': Number(item.cancelled) || 0,
      'Tổng lịch': Number(item.total) || 0,
      'Doanh thu': Number(item.revenue) || 0,
    };
  });

  // Appointments frequency
  const appointmentsDayData = (data.appointmentsByDay || []).map(item => {
    let dateLabel = item.date;
    try {
      dateLabel = format(parseISO(item.date), 'dd/MM', { locale: vi });
    } catch {
      // keep
    }
    return {
      date: dateLabel,
      'Lịch hẹn': item.count,
    };
  });

  const appointmentsWeekData = (data.appointmentsByWeek || []).map(item => {
    const weekParts = item.week.split('-W');
    const weekNum = weekParts[1] || item.week;
    return {
      week: `Tuần ${weekNum}`,
      'Lịch hẹn': item.count,
    };
  });

  // Retention Data for Donut
  const firstTimePatients = Math.max(0, (summary.totalPatients || 0) - (summary.returningPatients || 0));
  const returningCount = summary.returningPatients || 0;
  const retentionDonutData = [
    { name: 'Khách thân thiết (>1 lần)', value: returningCount, color: '#7c3aed' },
    { name: 'Khách mới (Khám 1 lần)', value: firstTimePatients, color: '#cbd5e1' },
  ].filter(d => (summary.totalPatients || 0) > 0 ? true : d.value > 0);

  // Storage
  let storageData: Array<{ name: string; value: number }> = [];
  let driveUsagePercent = 0;
  let formattedUsed = '0';
  let formattedTotal = '0';

  if (driveQuota?.limit && driveQuota?.usage) {
    const limitNum = Number(driveQuota.limit);
    const usedNum = Number(driveQuota.usage);
    if (limitNum > 0) {
      storageData = [
        { name: 'Đã sử dụng', value: usedNum },
        { name: 'Còn trống', value: Math.max(0, limitNum - usedNum) }
      ];
      driveUsagePercent = Math.round((usedNum / limitNum) * 100);
      formattedUsed = formatBytes(usedNum);
      formattedTotal = formatBytes(limitNum);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
          <Sparkles className="w-5 h-5 text-teal-600 absolute inset-0 m-auto" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Đang tải và chuẩn hóa số liệu thống kê...</p>
          <p className="text-xs text-slate-400 mt-1">Đồng bộ dữ liệu thời gian thực từ cơ sở dữ liệu y tế</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 pb-12 print:hidden">
      {/* 1. Header & Realtime Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100 shadow-2xs">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Báo cáo & Thống kê Y khoa
              </h1>
              {/* Realtime Live Pulse Badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Trực tiếp
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Cập nhật: <strong className="text-slate-700 font-semibold">{format(lastUpdated, 'HH:mm:ss - dd/MM/yyyy')}</strong></span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="text-slate-500 hidden sm:inline">Chuẩn hóa dữ liệu y tế</span>
            </p>
          </div>
        </div>

        {/* Action Controls: Structured Responsive Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
          {/* Time range selector (Segmented control) */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-medium text-slate-600 shadow-2xs">
            <button
              onClick={() => setTimeRange('7')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === '7' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              7 ngày
            </button>
            <button
              onClick={() => setTimeRange('14')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === '14' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              14 ngày
            </button>
            <button
              onClick={() => setTimeRange('30')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === '30' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              30 ngày
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === 'all' ? 'bg-white text-teal-800 font-bold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Đang tự động cập nhật mỗi 30 giây' : 'Tự động cập nhật đang tắt'}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all h-[38px] cursor-pointer ${
                autoRefresh 
                  ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 shadow-2xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 text-teal-600" />
              <span>Tự động: <strong>{autoRefresh ? 'Bật' : 'Tắt'}</strong></span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all disabled:opacity-50 h-[38px] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
              <span>Làm mới</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all h-[38px] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Xuất Excel</span>
            </button>

            {/* Print / Preview Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all h-[38px] active:scale-98 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 shrink-0 text-teal-400" />
              <span>In Báo Cáo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards (Bento Metric Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="relative overflow-hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Doanh Thu</span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div 
              className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight truncate" 
              title={formatVND(summary.totalRevenue)}
            >
              {formatVND(summary.totalRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 font-medium truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{summary.completedAppointments} ca khám đã hoàn tất</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Bình quân / ca:</span>
            <strong className="text-slate-800 font-semibold">{formatVND(summary.avgTicket)}</strong>
          </div>
        </div>

        {/* KPI 2: Total Appointments */}
        <div className="relative overflow-hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lượt Tiếp Nhận</span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {formatNumber(summary.totalAppointments)} <span className="text-sm font-medium text-slate-400">lượt</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> {summary.completedAppointments} xong
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                <XCircle className="w-3 h-3" /> {summary.cancelledAppointments} hủy
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${summary.completionRate}%` }}
              ></div>
              <div 
                className="bg-rose-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${summary.cancellationRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* KPI 3: Completion Rate */}
        <div className="relative overflow-hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-teal-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỉ Lệ Hoàn Tất Khám</span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-teal-700 tracking-tight truncate">
              {summary.completionRate}%
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-teal-800 font-medium truncate">
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Vận hành phòng khám tốt</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tỉ lệ hủy hẹn:</span>
            <strong className="text-rose-600 font-semibold">{summary.cancellationRate}%</strong>
          </div>
        </div>

        {/* KPI 4: Retention & Total Patients */}
        <div className="relative overflow-hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bệnh Nhân & Tái Khám</span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {formatNumber(summary.totalPatients)} <span className="text-sm font-medium text-slate-400">người</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-purple-700 font-medium truncate">
              <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Tỷ lệ quay lại: <strong>{summary.returningRate}%</strong></span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Khách thân thiết (&gt;1 lần):</span>
            <strong className="text-purple-700 font-semibold">{summary.returningPatients} người</strong>
          </div>
        </div>
      </div>

      {/* Google Drive Storage Quick Banner (if connected) */}
      {driveQuota && storageData.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Dung lượng Lưu trữ Hồ sơ Y tế (Google Drive)
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-800">
                  {driveUsagePercent}% đã dùng
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Đã sử dụng <strong>{formattedUsed}</strong> trong tổng số <strong>{formattedTotal}</strong>
              </p>
            </div>
          </div>
          <a
            href="https://drive.google.com/settings/storage"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline shrink-0"
          >
            Quản lý lưu trữ &rarr;
          </a>
        </div>
      )}

      {/* 3. Main Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Biến động Doanh thu theo ngày (AreaChart with Gradient) */}
        <Card className="shadow-xs border-slate-200/80">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Biến động Doanh thu theo Ngày
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Thống kê doanh thu thực nhận theo từng ngày khám</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Tổng thực thu</span>
              <div className="text-sm font-extrabold text-emerald-600">{formatVND(summary.totalRevenue)}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {timelineData.some(d => d['Doanh thu'] > 0) ? (
              <div className="h-[240px] sm:h-[280px] lg:h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: isMobile ? -25 : -5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="emeraldRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} 
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0].value) || 0;
                          return (
                            <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                              <p className="text-slate-400 font-medium">Ngày: <strong className="text-white">{label}</strong></p>
                              <p className="text-emerald-400 font-bold text-sm mt-1">
                                Doanh thu: {formatVND(val)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Doanh thu" 
                      stroke="#059669" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#emeraldRevenueGradient)" 
                      activeDot={{ r: 6, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[240px] sm:h-[280px] lg:h-[310px] flex flex-col items-center justify-center text-slate-400 text-xs">
                <DollarSign className="w-8 h-8 text-slate-300 mb-2" />
                Chưa có dữ liệu doanh thu hoàn thành trong khoảng thời gian này
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 2: Tần suất Lịch hẹn (Theo ngày / Theo tuần Toggle) */}
        <Card className="shadow-xs border-slate-200/80">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" />
                Tần suất Lịch hẹn Tiếp nhận
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Số lượt đặt hẹn được ghi nhận trên hệ thống</p>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setChartViewMode('day')}
                className={`px-2.5 py-1 rounded-md transition-all ${chartViewMode === 'day' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Theo Ngày
              </button>
              <button
                onClick={() => setChartViewMode('week')}
                className={`px-2.5 py-1 rounded-md transition-all ${chartViewMode === 'week' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Theo Tuần
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {chartViewMode === 'day' ? (
              appointmentsDayData.length > 0 ? (
                <div className="h-[240px] sm:h-[280px] lg:h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsDayData} margin={{ top: 10, right: 10, left: isMobile ? -25 : -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                                <p className="text-slate-400">Ngày: <strong className="text-white">{label}</strong></p>
                                <p className="text-blue-400 font-bold text-sm mt-1">
                                  {payload[0].value} lượt hẹn
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Lịch hẹn" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] sm:h-[280px] lg:h-[310px] flex items-center justify-center text-slate-400 text-xs">Chưa có dữ liệu</div>
              )
            ) : (
              appointmentsWeekData.length > 0 ? (
                <div className="h-[240px] sm:h-[280px] lg:h-[310px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsWeekData} margin={{ top: 10, right: 10, left: isMobile ? -25 : -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                                <p className="text-slate-400"><strong className="text-white">{label}</strong></p>
                                <p className="text-indigo-400 font-bold text-sm mt-1">
                                  {payload[0].value} lượt hẹn
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Lịch hẹn" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={55} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] sm:h-[280px] lg:h-[310px] flex items-center justify-center text-slate-400 text-xs">Chưa có dữ liệu</div>
              )
            )}
          </CardContent>
        </Card>

        {/* CHART 3: Cơ cấu Doanh thu Dịch vụ Mũi Nhọn (Modern Donut Chart with Breakdown List) */}
        <Card className="shadow-xs border-slate-200/80">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                Cơ cấu Doanh thu theo Dịch vụ Mũi Nhọn
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Tỷ trọng đóng góp doanh thu của từng dịch vụ nha khoa</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {pieData.length} dịch vụ phát sinh
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            {pieData.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6">
                {/* Donut Chart with Center Label */}
                <div className="relative w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={isMobile ? 55 : 65} 
                        outerRadius={isMobile ? 80 : 95}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                                <p className="font-semibold text-white">{d.name}</p>
                                <p className="text-emerald-400 font-bold mt-1">{formatVND(d.value)} ({d.percent}%)</p>
                                <p className="text-slate-400 text-[11px]">{d.count} ca điều trị</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tổng Thu</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 leading-tight">{formatVND(summary.totalRevenue)}</span>
                  </div>
                </div>

                {/* Structured Breakdown List with Thousand Separator & % */}
                <div className="w-full flex-1 space-y-2.5 sm:space-y-3">
                  {pieData.map((item, index) => {
                    const color = SERVICE_COLORS[index % SERVICE_COLORS.length];
                    return (
                      <div key={item.name} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                            <span className="font-semibold text-slate-800 truncate" title={item.name}>{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">{formatVND(item.value)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{item.count} lượt khám</span>
                          <span className="font-semibold text-teal-700">{item.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: color }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu doanh thu hoàn thành
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 4: Tỷ lệ Khách hàng Quay lại (Clean Modern Donut - No Label Clutter) */}
        <Card className="shadow-xs border-slate-200/80">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Tỷ lệ Khách hàng Quay lại (Retention)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Đo lường mức độ trung thành và tái khám của bệnh nhân</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              {summary.returningRate}% Tái khám
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            {summary.totalPatients > 0 ? (
              <div className="flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6">
                {/* Donut Chart with Center Percentage */}
                <div className="relative w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={retentionDonutData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={isMobile ? 55 : 65} 
                        outerRadius={isMobile ? 80 : 95}
                        paddingAngle={4}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {retentionDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const pct = summary.totalPatients > 0 ? Math.round((d.value / summary.totalPatients) * 100) : 0;
                            return (
                              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
                                <p className="font-semibold text-white">{d.name}</p>
                                <p className="text-purple-300 font-bold mt-1">{d.value} bệnh nhân ({pct}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TÁI KHÁM</span>
                    <span className="text-xl sm:text-2xl font-extrabold text-purple-700">{summary.returningRate}%</span>
                  </div>
                </div>

                {/* Structured Retention Metrics */}
                <div className="w-full flex-1 space-y-2.5 sm:space-y-3">
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0"></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Khách thân thiết (&gt;1 lần)</div>
                        <div className="text-[11px] text-purple-700">Tái khám định kỳ / làm lộ trình</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-purple-900">{returningCount}</div>
                      <div className="text-[10px] font-semibold text-purple-600">{summary.returningRate}%</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0"></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Khách mới (Khám 1 lần)</div>
                        <div className="text-[11px] text-slate-500">Lần đầu đến phòng khám</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-800">{firstTimePatients}</div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        {summary.totalPatients > 0 ? Math.round((firstTimePatients / summary.totalPatients) * 100) : 0}%
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                    💡 Khuyến nghị: Tận dụng tính năng nhắc hẹn & khám định kỳ để gia tăng tỉ lệ quay lại lên trên 35%.
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu bệnh nhân
              </div>
            )}
          </CardContent>
        </Card>

        {/* CHART 5: Tỉ lệ Lấp đầy & Tỉ lệ Hủy (Grouped Bar Chart) */}
        <Card className="shadow-xs border-slate-200/80 lg:col-span-2">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                Tỉ lệ Lấp đầy & Tỉ lệ Hủy theo Mốc Thời Gian
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">So sánh tương quan giữa số lịch hẹn khám thành công và số lịch bị hủy / vắng mặt</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Hoàn thành
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <span className="w-3 h-3 rounded-sm bg-rose-500"></span> Hủy / Bỏ hẹn
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {timelineData.length > 0 ? (
              <div className="h-[250px] sm:h-[280px] lg:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 10, right: 10, left: isMobile ? -25 : -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const completed = payload.find(p => p.dataKey === 'Hoàn thành')?.value || 0;
                          const cancelled = payload.find(p => p.dataKey === 'Hủy/Bỏ hẹn')?.value || 0;
                          const total = Number(completed) + Number(cancelled);
                          return (
                            <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
                              <p className="text-slate-400 font-medium">Mốc ngày: <strong className="text-white">{label}</strong></p>
                              <p className="text-emerald-400 font-semibold">✓ Hoàn thành: {completed} ca</p>
                              <p className="text-rose-400 font-semibold">✕ Đã hủy: {cancelled} ca</p>
                              <p className="text-slate-300 text-[11px] pt-1 border-t border-slate-800">
                                Tổng tiếp nhận: {total} lượt
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="Hủy/Bỏ hẹn" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] sm:h-[280px] lg:h-[300px] flex items-center justify-center text-slate-400 text-xs">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Detailed Medical Performance Section (Adaptive Cards & Table) */}
      <Card className="shadow-xs border-slate-200/80">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-600" />
              Bảng Phân Tích Hiệu Suất & Doanh Thu Dịch Vụ Nha Khoa
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Số liệu chuẩn hóa với dấu phân tách phần nghìn và tỷ trọng doanh thu thực tế</p>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setServiceViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  serviceViewMode === 'cards' 
                    ? 'bg-white text-teal-700 font-bold shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng thẻ trực quan cho di động"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  serviceViewMode === 'table' 
                    ? 'bg-white text-teal-700 font-bold shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem bảng số liệu chi tiết"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Bảng</span>
              </button>
            </div>
            <span className="text-xs text-slate-500 hidden md:inline">
              <strong className="text-slate-800">{data.serviceStats?.length || 0}</strong> dịch vụ
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {serviceViewMode === 'cards' ? (
            /* Card Grid View - Mobile friendly, zero horizontal clipping */
            <div className="p-4 space-y-4">
              {isMobile && (
                <div className="text-[11px] text-teal-700 bg-teal-50/70 border border-teal-100 rounded-lg px-3 py-1.5 flex items-center justify-between">
                  <span>📱 Giao diện thẻ tối ưu cho điện thoại di động</span>
                  <button 
                    onClick={() => setServiceViewMode('table')}
                    className="font-semibold underline ml-2 shrink-0"
                  >
                    Xem bảng
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data.serviceStats || []).map((service, index) => {
                  const isTopRevenue = index === 0 && (service.revenue || 0) > 0;
                  return (
                    <div 
                      key={service.id || service.name} 
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-teal-300 hover:shadow-xs transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            index === 0 ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' :
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                            index === 2 ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {index + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={service.name}>
                            {service.name}
                          </h4>
                        </div>
                        {isTopRevenue ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            ★ Dịch vụ mũi nhọn
                          </span>
                        ) : (service.revenue || 0) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Ổn định
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                            Khám tư vấn
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500">Doanh thu ghi nhận:</span>
                        <span className="text-sm font-extrabold text-emerald-700">{formatVND(service.revenue)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-lg">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Số ca thực hiện</span>
                          <span className="font-bold text-slate-800">{formatNumber(service.count)} ca</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Thời lượng khám</span>
                          <span className="font-medium text-slate-700">{service.durationMins || 30} phút/ca</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Tỷ trọng doanh thu</span>
                          <span className="font-bold text-teal-700">{service.percent || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-teal-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${service.percent || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(!data.serviceStats || data.serviceStats.length === 0) && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Chưa có dữ liệu dịch vụ nha khoa nào
                </div>
              )}

              {/* Total Summary Footer Card */}
              {summary.totalRevenue > 0 && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-900 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase font-bold tracking-wider text-teal-300">Tổng kết doanh thu toàn bộ dịch vụ</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Tổng số ca đã tiếp nhận điều trị: <strong className="text-white">{formatNumber(data.serviceStats?.reduce((a, b) => a + b.count, 0) || 0)}</strong> ca
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-emerald-400">{formatVND(summary.totalRevenue)}</div>
                    <div className="text-[10px] text-slate-400">100% doanh thu thực nhận</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Table View with responsive scroll */
            <div className="overflow-x-auto">
              {isMobile && (
                <div className="text-[11px] text-slate-500 bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span>👉 Vuốt ngang bảng để xem đầy đủ các cột số liệu</span>
                  <button 
                    onClick={() => setServiceViewMode('cards')}
                    className="font-semibold text-teal-700 underline shrink-0"
                  >
                    Xem dạng thẻ
                  </button>
                </div>
              )}
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Tên Dịch Vụ Nha Khoa</th>
                    <th className="py-3 px-4 text-center">Thời Lượng</th>
                    <th className="py-3 px-4 text-center">Số Ca Tiếp Nhận</th>
                    <th className="py-3 px-4 text-right">Tổng Doanh Thu</th>
                    <th className="py-3 px-4 text-center">Tỷ Trọng Doanh Thu</th>
                    <th className="py-3 px-4 text-center">Phân Loại Hiệu Quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.serviceStats || []).map((service, index) => {
                    const isTopRevenue = index === 0 && (service.revenue || 0) > 0;
                    return (
                      <tr key={service.id || service.name} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-medium">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {isTopRevenue && <span className="text-amber-500 text-xs">★</span>}
                            <span>{service.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            <Clock className="w-3 h-3" /> {service.durationMins || 30}p
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {formatNumber(service.count)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700 text-sm">
                          {formatVND(service.revenue)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 max-w-[120px] mx-auto">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-teal-600 h-full rounded-full" 
                                style={{ width: `${service.percent || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 w-8 text-right">
                              {service.percent || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isTopRevenue ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Dịch vụ mũi nhọn
                            </span>
                          ) : (service.revenue || 0) > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Doanh thu ổn định
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                              Khám tư vấn
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!data.serviceStats || data.serviceStats.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Chưa có dữ liệu dịch vụ nha khoa nào
                      </td>
                    </tr>
                  )}
                </tbody>
                {summary.totalRevenue > 0 && (
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 uppercase text-xs tracking-wider">
                        Tổng kết toàn bộ dịch vụ
                      </td>
                      <td className="py-3 px-4 text-center text-slate-900">
                        {formatNumber(data.serviceStats?.reduce((a, b) => a + b.count, 0) || 0)} ca
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 text-base">
                        {formatVND(summary.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-center text-teal-700">100%</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>

    {/* Print-Only Document for High Quality Standard A4 Reports */}
    <PrintMedicalDocument
      summary={summary}
      serviceStats={data.serviceStats || []}
      occupancyStats={data.occupancyStats || []}
      timeRange={timeRange}
      clinicProfile={clinicProfile}
      currentUser={user}
      printConfig={printConfig}
    />

    {/* Analytics Print & Export Modal */}
    <AnalyticsPrintModal
      isOpen={showPrintModal}
      onClose={() => setShowPrintModal(false)}
      summary={summary}
      serviceStats={data.serviceStats || []}
      occupancyStats={data.occupancyStats || []}
      timeRange={timeRange}
      clinicProfile={clinicProfile}
      currentUser={user}
      onExportExcel={handleExportExcel}
      printConfig={printConfig}
      onUpdateConfig={setPrintConfig}
    />
    </>
  );
}
