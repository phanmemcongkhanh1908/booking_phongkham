import React, { useState, useEffect } from 'react';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

export default function OtpQuotaWidget() {
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuota();
    // Poll every 5 minutes to keep it updated
    const interval = setInterval(fetchQuota, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchQuota = async () => {
    try {
      const res = await api.get('/admin/system/metrics');
      if (res.data.success && res.data.data.otp) {
        setQuota(res.data.data.otp);
      }
    } catch (err) {
      console.error("Lỗi lấy dữ liệu quota OTP", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (!quota) return null;

  const percentUsed = Math.min(100, Math.max(0, (quota.used / quota.limit) * 100));
  const isWarning = percentUsed >= 80;
  const isDanger = percentUsed >= 95;

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs" title="Quota SMS Firebase (Free Tier)">
      <div className={\`p-1.5 rounded-lg \${isDanger ? 'bg-rose-100 text-rose-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}\`}>
        {isWarning ? <AlertTriangle className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
      </div>
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span>OTP SMS Miễn phí</span>
          <span className={isDanger ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-600'}>
            {quota.remaining.toLocaleString()}/tháng
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={\`h-full transition-all \${isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'}\`}
            style={{ width: \`\${percentUsed}%\` }}
          />
        </div>
      </div>
    </div>
  );
}
