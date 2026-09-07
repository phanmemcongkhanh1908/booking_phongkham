import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { 
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  LineChart, Line
} from 'recharts';
import api from '../../services/api';
import { format, parseISO } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Analytics() {
  const [data, setData] = useState<{ serviceStats: any[], occupancyStats: any[] }>({
    serviceStats: [], occupancyStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then(res => {
      setData(res.data.data);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Card>
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
