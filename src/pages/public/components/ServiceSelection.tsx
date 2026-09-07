import React, { useEffect, useState, useMemo } from 'react';
import { useBookingStore } from '../../../store/booking';
import api from '../../../services/api';
import { 
  Stethoscope, 
  Sparkles, 
  Activity, 
  ShieldCheck, 
  Clock, 
  ChevronRight, 
  Search, 
  Check, 
  HelpCircle,
  Tag,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Service {
  id: string;
  name: string;
  durationMins: number;
  price: number;
  description?: string;
}

export default function ServiceSelection() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const currentServiceId = useBookingStore(state => state.serviceId);
  const setService = useBookingStore(state => state.setService);
  const clearHold = useBookingStore(state => state.clearHold);
  const navigate = useNavigate();

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/public/services');
      if (res.data.success && Array.isArray(res.data.data)) {
        setServices(res.data.data);
      } else {
        setError('Không thể tải danh sách dịch vụ y tế. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error("Failed to fetch services", err);
      setError('Không thể kết nối đến hệ thống máy chủ để tải danh mục dịch vụ. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Categorize helper based on keywords
  const getCategory = (name: string): { key: string; label: string; icon: React.ReactNode } => {
    const lower = name.toLowerCase();
    if (lower.includes('khám') || lower.includes('tư vấn') || lower.includes('tổng quát')) {
      return { key: 'consult', label: 'Khám & Tư vấn', icon: <Stethoscope className="w-4 h-4" /> };
    }
    if (lower.includes('tẩy trắng') || lower.includes('thẩm mỹ') || lower.includes('composite') || lower.includes('dán sứ') || lower.includes('niềng')) {
      return { key: 'cosmetic', label: 'Thẩm mỹ', icon: <Sparkles className="w-4 h-4" /> };
    }
    if (lower.includes('nhổ') || lower.includes('phẫu thuật') || lower.includes('răng khôn') || lower.includes('chữa tủy') || lower.includes('sâu')) {
      return { key: 'treatment', label: 'Điều trị & Phẫu thuật', icon: <Activity className="w-4 h-4" /> };
    }
    return { key: 'care', label: 'Vệ sinh & Chăm sóc', icon: <ShieldCheck className="w-4 h-4" /> };
  };

  const categories = useMemo(() => [
    { key: 'all', label: 'Tất cả dịch vụ' },
    { key: 'consult', label: 'Khám & Tư vấn' },
    { key: 'care', label: 'Vệ sinh & Cạo vôi' },
    { key: 'cosmetic', label: 'Nha khoa Thẩm mỹ' },
    { key: 'treatment', label: 'Điều trị & Phẫu thuật' }
  ], []);

  const filteredServices = useMemo(() => {
    return services.filter(svc => {
      const matchSearch = svc.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (selectedCategory === 'all') return true;
      const cat = getCategory(svc.name);
      return cat.key === selectedCategory;
    });
  }, [services, searchQuery, selectedCategory]);

  const handleSelectService = (svc: Service) => {
    if (currentServiceId && currentServiceId !== svc.id) {
      clearHold();
    }
    setService(svc.id, svc.name, svc.price, svc.durationMins);
    navigate('/book/chon-gio');
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-lg shadow-slate-200/50 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-teal-700/30 border-t-teal-700 rounded-full animate-spin" />
        <p className="text-slate-600 font-semibold text-sm">Đang tải danh mục dịch vụ khám tiêu chuẩn...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-lg shadow-red-100/40 flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-lg font-bold text-slate-900">Không thể tải danh sách dịch vụ</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchServices}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold shadow-md shadow-teal-900/10 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-teal-500/5 via-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200/60 mb-2">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                Bước 1 / 3
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Chọn Dịch Vụ Khám
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                Lựa chọn đúng nhu cầu chăm sóc răng miệng. Bác sĩ sẽ chuẩn bị phòng thủ thuật và trang thiết bị chuyên dụng đón bạn.
              </p>
            </div>

            {/* Quick Search Input */}
            <div className="relative sm:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Tìm kiếm dịch vụ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all outline-none"
              />
            </div>
          </div>

          {/* Specialty Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-hide">
            {categories.map(cat => {
              const isActive = selectedCategory === cat.key;
              const count = cat.key === 'all' 
                ? services.length 
                : services.filter(s => getCategory(s.name).key === cat.key).length;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-800">Không tìm thấy dịch vụ phù hợp</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để hiển thị toàn bộ dịch vụ nha khoa.
          </p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-teal-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            Xem lại tất cả dịch vụ
          </button>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2">
          {filteredServices.map((svc) => {
            const cat = getCategory(svc.name);
            const isSelected = currentServiceId === svc.id;
            const formattedPrice = svc.price && Number(svc.price) > 0 
              ? `${Number(svc.price).toLocaleString('vi-VN')}đ` 
              : 'Miễn phí';

            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleSelectService(svc)}
                className={`group relative text-left rounded-2xl border p-4 sm:p-5 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer ${
                  isSelected 
                    ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-600/30 shadow-md' 
                    : 'border-slate-200/90 bg-white hover:border-teal-500/80 hover:shadow-xl hover:shadow-teal-900/5 hover:-translate-y-0.5'
                }`}
              >
                {/* Top Row: Category tag + Checkmark */}
                <div className="flex items-center justify-between gap-2 w-full mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-tight bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-teal-800 transition-colors">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </span>

                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-teal-700 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-400 group-hover:bg-teal-600 group-hover:text-white'
                  }`}>
                    {isSelected ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                  </div>
                </div>

                {/* Main Content: Title & Details */}
                <div className="space-y-1 mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {svc.description || 'Quy trình vô trùng y khoa khép kín, được thực hiện bởi bác sĩ giàu kinh nghiệm.'}
                  </p>
                </div>

                {/* Bottom Row: Duration + Price Badge */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 w-full text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>~{svc.durationMins || 30} phút</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm sm:text-base text-teal-700 group-hover:text-teal-800">
                      {formattedPrice}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-teal-700 transition-colors">
                      Chọn <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Advisory Callout for patients unsure what to choose */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/70 via-emerald-50/50 to-transparent p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="text-xs sm:text-sm text-slate-700 space-y-1">
          <p className="font-bold text-slate-900">
            Bạn chưa chắc chắn tình trạng răng miệng hiện tại?
          </p>
          <p className="text-slate-600 leading-relaxed">
            Hãy lựa chọn <strong>Khám răng tổng quát & Tư vấn</strong>. Bác sĩ sẽ kiểm tra trực tiếp, chụp phim x-quang (nếu cần) và trao đổi chi tiết phác đồ trước khi bạn quyết định điều trị.
          </p>
        </div>
      </div>
    </div>
  );
}
