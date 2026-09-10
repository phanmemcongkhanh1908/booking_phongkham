import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { 
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import api from '../../services/api';
import { format, parseISO } from 'date-fns';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { fetchDriveQuota, formatBytes, DriveQuota } from '../../lib/googleWorkspace';
import { useAuthStore } from '../../store/auth';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const RETENTION_COLORS = ['#8b5cf6', '#e2e8f0'];
const STORAGE_COLORS = ['#3b82f6', '#e2e8f0'];

export default function Analytics() {
  const [data, setData] = useState<{ 
    serviceStats: any[], 
    occupancyStats: any[],
    appointmentsByDay?: {date: string, count: number}[],
    appointmentsByWeek?: {week: string, count: number}[],
    returningRate?: number,
    totalPatients?: number,
    returningPatients?: number
  }>({
    serviceStats: [], occupancyStats: []
  });
  const [loading, setLoading] = useState(true);
  
  const user = useAuthStore(state => state.user);
  const { isConnected, accessToken } = useGoogleAuthStore();
  const [driveQuota, setDriveQuota] = useState<DriveQuota | null>(null);

  useEffect(() => {
    api.get('/admin/analytics').then(res => {
      setData(res.data.data);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

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
                // Check local storage to prevent spamming the email every time the page loads
                const lastAlertStr = localStorage.getItem('lastStorageAlert_' + user?.id);
                const lastAlert = lastAlertStr ? parseInt(lastAlertStr) : 0;
                const now = Date.now();
                // Only send alert once every 7 days per user
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

  if (loading) return <div className="p-8 text-center text-text-muted">Đang tải dữ liệu báo cáo...</div>;

  const pieData = data.serviceStats.map(item => ({
    name: item.name,
    value: Number(item.revenue) || 0
  })).filter(i => i.value > 0);

  const barData = data.occupancyStats.map(item => ({
    date: format(parseISO(item.date), 'dd/MM'),
    'Hoàn thành': Number(item.completed) || 0,
    'Hủy/Bỏ hẹn': Number(item.cancelled) || 0,
    'Doanh thu': Number(item.revenue) || 0,
  }));

  const appointmentsDayData = data.appointmentsByDay?.map(item => ({
    date: format(parseISO(item.date), 'dd/MM'),
    'Lịch hẹn': item.count
  })) || [];

  const appointmentsWeekData = data.appointmentsByWeek?.map(item => {
    // Convert "2026-W36" to "Tuần 36"
    const weekNum = item.week.split('-W')[1];
    return {
      week: `Tuần ${weekNum}`,
      'Lịch hẹn': item.count
    };
  }) || [];

  const retentionData = [
    { name: 'Quay lại (>1 lần)', value: data.returningPatients || 0 },
    { name: 'Khám 1 lần', value: (data.totalPatients || 0) - (data.returningPatients || 0) }
  ];

  let storageData: any[] = [];
  let driveUsagePercent = 0;
  let formattedUsed = '0';
  let formattedTotal = '0';

  if (driveQuota?.limit && driveQuota?.usage) {
    const limitNum = Number(driveQuota.limit);
    const usedNum = Number(driveQuota.usage);
    if (limitNum > 0) {
      storageData = [
        { name: 'Đã sử dụng', value: usedNum },
        { name: 'Còn trống', value: limitNum - usedNum }
      ];
      driveUsagePercent = Math.round((usedNum / limitNum) * 100);
      formattedUsed = formatBytes(usedNum);
      formattedTotal = formatBytes(limitNum);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-indigo-600 mb-1">Tỷ lệ khách quay lại</h3>
            <div className="text-3xl font-bold text-indigo-900">{data.returningRate || 0}%</div>
            <p className="text-xs text-indigo-500 mt-1">Khách khám từ 2 lần trở lên</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-emerald-600 mb-1">Tổng bệnh nhân</h3>
            <div className="text-3xl font-bold text-emerald-900">{data.totalPatients || 0}</div>
            <p className="text-xs text-emerald-500 mt-1">Bệnh nhân đã hoàn thành khám</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-blue-600 mb-1">Tổng lượt hẹn (14 ngày)</h3>
            <div className="text-3xl font-bold text-blue-900">
              {data.appointmentsByDay?.reduce((sum, item) => sum + item.count, 0) || 0}
            </div>
            <p className="text-xs text-blue-500 mt-1">Lịch hẹn được ghi nhận</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Drive Storage (If Connected) */}
        {driveQuota && storageData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dung lượng Google Drive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex flex-col items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={storageData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={80} 
                      outerRadius={100}
                    >
                      {storageData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={STORAGE_COLORS[index % STORAGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip formatter={(val: any) => formatBytes(val)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered Percentage */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                  <span className="text-3xl font-extrabold text-blue-900">{driveUsagePercent}%</span>
                  <span className="text-xs text-slate-500 font-medium">Đã sử dụng</span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-2">
                Đã dùng {formattedUsed} / {formattedTotal}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Appointments by Day */}
        <Card>
          <CardHeader>
            <CardTitle>Số lượng lịch hẹn theo ngày (14 ngày qua)</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsDayData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={appointmentsDayData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <BarTooltip />
                    <Area type="monotone" dataKey="Lịch hẹn" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        {/* Appointments by Week */}
        <Card>
          <CardHeader>
            <CardTitle>Số lượng lịch hẹn theo tuần (10 tuần qua)</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsWeekData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentsWeekData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" />
                    <YAxis allowDecimals={false} />
                    <BarTooltip />
                    <Bar dataKey="Lịch hẹn" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tỷ lệ khách hàng quay lại</CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalPatients ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={retentionData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60}
                      outerRadius={100} 
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {retentionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={RETENTION_COLORS[index % RETENTION_COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cơ cấu Doanh thu theo Dịch vụ mũi nhọn</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip formatter={(val: any) => (val !== undefined && val !== null ? Number(val).toLocaleString('vi-VN') : '0') + ' đ'} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu doanh thu hoàn thành</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tỉ lệ lấp đầy & Tỉ lệ Hủy (7 ngày qua)</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <BarTooltip />
                    <Legend />
                    <Bar dataKey="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Hủy/Bỏ hẹn" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Biến động Doanh thu (7 ngày qua)</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.some(d => d['Doanh thu'] > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    />
                    <BarTooltip formatter={(val: any) => (val !== undefined && val !== null ? Number(val).toLocaleString('vi-VN') : '0') + ' đ'} />
                    <Legend />
                    <Line type="monotone" dataKey="Doanh thu" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-muted/60">Chưa có dữ liệu doanh thu</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
