import React, { useEffect, useState } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { ChevronRight, Stethoscope } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  durationMins: number;
  price: number;
}

export default function ServiceSelection() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const setService = useBookingStore(state => state.setService);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/public/services');
        if (res.data.success) {
          setServices(res.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch services", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServices();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Đang tải danh sách dịch vụ...</div>;
  }

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-soft">
      <CardHeader className="text-center sm:text-left">
        <CardTitle className="text-xl">Chọn dịch vụ nha khoa</CardTitle>
        <p className="text-sm text-text-muted">Vui lòng chọn dịch vụ bạn muốn thực hiện để chúng tôi sắp xếp thời gian phù hợp nhất.</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {services.map((svc) => (
          <div
            key={svc.id}
            onClick={() => setService(svc.id, svc.name)}
            className="group flex cursor-pointer items-center justify-between rounded-card border border-border-subtle bg-surface p-4 transition-all hover:border-teal-600 hover:bg-mint hover:shadow-soft"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Stethoscope size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-text-main">{svc.name}</h4>
                <p className="text-sm text-text-muted">Thời gian: ~{svc.durationMins} phút • {svc.price ? `${svc.price.toLocaleString()}đ` : 'Miễn phí'}</p>
              </div>
            </div>
            <ChevronRight className="text-text-muted/60 group-hover:text-primary" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
