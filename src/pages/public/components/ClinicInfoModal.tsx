import React, { useMemo, useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Stethoscope,
  UserCheck,
  Star,
  CalendarPlus,
  Building2,
  Search,
  Award,
} from 'lucide-react';
import { ClinicBundleData, BusinessHoursInfo, ClinicBrandingInfo } from '../../../services/clinicResolver';
import { buildGoogleMapsDirectionsUrl, formatClinicSlogan } from '../../../utils/maps';
import ClinicLocationMap from '../../../components/ClinicLocationMap';
import ClinicReputationWidget from '../../../components/ClinicReputationWidget';

interface ClinicInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicProfile: ClinicBrandingInfo | null;
  businessHours: BusinessHoursInfo | null;
  services: ClinicBundleData['services'];
  providers: ClinicBundleData['providers'];
  isCurrentlyOpen: boolean;
  onBookService?: (service: ClinicBundleData['services'][number]) => void;
  onStartBooking?: () => void;
}

type InfoTab = 'overview' | 'services' | 'reviews';

export default function ClinicInfoModal({
  isOpen,
  onClose,
  clinicProfile,
  businessHours,
  services,
  providers,
  isCurrentlyOpen,
  onBookService,
  onStartBooking,
}: ClinicInfoModalProps) {
  const [activeTab, setActiveTab] = useState<InfoTab>('overview');
  const [serviceSearch, setServiceSearch] = useState('');

  const clinicName = clinicProfile?.clinicName || clinicProfile?.name || 'Phòng khám Nha khoa';
  const slogan = formatClinicSlogan(clinicProfile?.slogan);
  const rawDoctor = clinicProfile?.doctorName || '';
  const leadDoctor = rawDoctor
    ? rawDoctor.startsWith('Bs') || rawDoctor.startsWith('BS')
      ? rawDoctor
      : `BS. ${rawDoctor}`
    : null;
  const phone = clinicProfile?.phone || clinicProfile?.hotline || '';
  const address = clinicProfile?.address || '';
  const hasCoords =
    typeof clinicProfile?.latitude === 'number' &&
    typeof clinicProfile?.longitude === 'number' &&
    Number.isFinite(clinicProfile.latitude) &&
    Number.isFinite(clinicProfile.longitude);

  const activeProviders = useMemo(
    () => (providers || []).filter((p) => p && p.isActive !== false),
    [providers]
  );

  const activeServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return (services || [])
      .filter((s) => s && s.isActive !== false)
      .filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [services, serviceSearch]);

  if (!isOpen) return null;

  const mapsUrl = address || hasCoords
    ? buildGoogleMapsDirectionsUrl(address, clinicProfile?.latitude, clinicProfile?.longitude)
    : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinic-info-modal-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200/80 flex items-start justify-between gap-3 bg-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="clinic-info-modal-title"
                className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight truncate"
              >
                {clinicName}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                {businessHours && (
                  <span className={`font-bold ${isCurrentlyOpen ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {isCurrentlyOpen ? 'Đang mở cửa' : 'Tạm đóng'}
                  </span>
                )}
                {leadDoctor && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{leadDoctor}</span>
                  </>
                )}
                {slogan && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="italic truncate max-w-[240px]">“{slogan}”</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông tin phòng khám"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Giờ làm &amp; Bản đồ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bảng dịch vụ ({activeServices.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đánh giá uy tín
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Working hours & Hotline */}
              <div className="grid sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Clock className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Thời gian làm việc</span>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {businessHours?.workingHoursStr || '08:00 - 20:00'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {businessHours?.scheduleSummary || 'Phục vụ khám tất cả các ngày làm việc trong tuần.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Phone className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Tư vấn &amp; Liên hệ trực tiếp</span>
                  </div>
                  {phone ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-black text-teal-800 tabular-nums">{phone}</span>
                      <a
                        href={`tel:${phone}`}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Gọi ngay</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Chưa cập nhật số hotline.</p>
                  )}
                </div>
              </div>

              {/* Address + Map */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-500">Địa chỉ phòng khám</p>
                      <p className="text-sm font-bold text-slate-900 leading-snug">
                        {address || 'Đang cập nhật địa chỉ chi tiết'}
                      </p>
                    </div>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Navigation className="w-4 h-4 text-teal-700" />
                      <span>Mở Google Maps chỉ đường</span>
                    </a>
                  )}
                </div>

                {hasCoords && (
                  <ClinicLocationMap
                    latitude={clinicProfile!.latitude ?? null}
                    longitude={clinicProfile!.longitude ?? null}
                    clinicName={clinicName}
                    readOnly
                  />
                )}
              </div>

              {/* Doctors Team */}
              {activeProviders.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal-700" />
                    <span>Đội ngũ Bác sĩ phụ trách ({activeProviders.length})</span>
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {activeProviders.map((prov) => (
                      <div
                        key={prov.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{prov.name}</p>
                          {prov.specialty && (
                            <p className="text-xs text-teal-700 font-semibold">{prov.specialty}</p>
                          )}
                          {prov.experience && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Award className="w-3 h-3 shrink-0" />
                              <span>{prov.experience}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Tìm kiếm nhanh dịch vụ hoặc bảng giá..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 outline-none"
                />
              </div>

              {activeServices.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  Không tìm thấy dịch vụ phù hợp.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl bg-white overflow-hidden">
                  {activeServices.map((svc) => {
                    let priceText = 'Liên hệ tư vấn';
                    if (svc.showPrice) {
                      if (svc.isFree) {
                        priceText = 'Miễn phí';
                      } else if (svc.price && Number(svc.price) > 0) {
                        priceText = `${Number(svc.price).toLocaleString('vi-VN')}đ`;
                      }
                    }

                    const ratedCount = Number(svc.ratingStats?.ratedCount || 0);
                    const avgRating = Number(svc.ratingStats?.averageRating || 0);

                    return (
                      <div
                        key={svc.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-bold text-slate-900">{svc.name}</p>
                          {svc.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">{svc.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                            <span className="tabular-nums">~{svc.durationMins || 30} phút</span>
                            {svc.showRating !== false && ratedCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {avgRating.toFixed(1)} ({ratedCount})
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="text-sm font-black text-teal-700 tabular-nums">
                            {priceText}
                          </span>
                          {onBookService && (
                            <button
                              type="button"
                              onClick={() => onBookService(svc)}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                            >
                              Đặt lịch này
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="-my-6">
              <ClinicReputationWidget variant="full" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            Đóng lại
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartBooking?.();
            }}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-extrabold shadow-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Đặt lịch khám ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
}
