import React, { useState } from 'react';
import { 
  Star, 
  X, 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit3, 
  Calendar, 
  User, 
  Stethoscope, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface AdminReviewManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any | null;
  onSuccess: () => void;
  onEditReview: (appointment: any) => void;
}

export default function AdminReviewManageModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
  onEditReview
}: AdminReviewManageModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !appointment) return null;

  const isHidden = Boolean(appointment.isReviewHidden);
  const isRatingHidden = Boolean(appointment.isRatingHidden);
  const rating = Number(appointment.rating) || 5;

  const handleToggleVisibility = async () => {
    setLoadingAction('toggle');
    try {
      const res = await api.patch(`/appointments/${appointment.id}/review/toggle-visibility`, {
        isReviewHidden: !isHidden
      });
      if (res.data?.success) {
        toast.success(res.data.message || (isHidden ? 'Đã hiện đánh giá công khai' : 'Đã ẩn đánh giá khỏi trang công khai'));
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Không thể cập nhật trạng thái hiển thị đánh giá');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleToggleRatingVisibility = async () => {
    setLoadingAction('toggle-rating');
    try {
      const res = await api.patch(`/appointments/${appointment.id}/review/toggle-rating-visibility`, {
        isRatingHidden: !isRatingHidden
      });
      if (res.data?.success) {
        toast.success(res.data.message || (isRatingHidden ? 'Đã bật hiển thị điểm sao điều trị' : 'Đã ẩn điểm sao của đợt điều trị này'));
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Không thể cập nhật trạng thái hiển thị điểm sao');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteReview = async () => {
    setLoadingAction('delete');
    try {
      const res = await api.delete(`/appointments/${appointment.id}/review`);
      if (res.data?.success) {
        toast.success('Đã xóa vĩnh viễn đánh giá thành công');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Không thể xóa đánh giá');
    } finally {
      setLoadingAction(null);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Quản lý Đánh giá Bệnh nhân</h3>
              <p className="text-xs text-slate-500">Ẩn / Hiện trên trang công khai hoặc gỡ bỏ đánh giá</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Appointment brief */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                {appointment.patientName || 'Bệnh nhân'}
              </span>
              {appointment.patientPhone && (
                <span className="font-mono text-slate-500">{appointment.patientPhone}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 truncate max-w-[240px]">
                <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                {appointment.serviceName || appointment.customServiceName || 'Dịch vụ khám'}
              </span>
              {appointment.startAt && (
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {format(new Date(appointment.startAt), 'dd/MM/yyyy HH:mm')}
                </span>
              )}
            </div>
          </div>

          {/* Rating & Review Details */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/60 border border-amber-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/50 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="font-extrabold text-sm text-slate-800">
                  {rating}/5 Sao
                </span>
                {isRatingHidden ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    <EyeOff className="w-3 h-3 text-purple-700" />
                    Đã ẩn sao
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    Hiện sao
                  </span>
                )}
              </div>

              {/* Review status pill */}
              {isHidden ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                  Đang ẨN ĐÁNH GIÁ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Đang HIỆN CÔNG KHAI
                </span>
              )}
            </div>

            {appointment.reviewTags && appointment.reviewTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {appointment.reviewTags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-xs bg-white border border-amber-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium shadow-2xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {appointment.reviewComment ? (
              <div className="bg-white/90 p-3 rounded-xl border border-amber-200/70 text-xs text-slate-700 italic leading-relaxed">
                "{appointment.reviewComment}"
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Bệnh nhân không để lại bình luận chữ.</p>
            )}

            {appointment.reviewedAt && (
              <p className="text-[11px] text-slate-400 text-right">
                Đánh giá lúc: {format(new Date(appointment.reviewedAt), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </div>

          {/* Visibility Info Banners */}
          <div className="space-y-2">
            {isHidden ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <EyeOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Đánh giá này đang bị ẩn toàn bộ</p>
                  <p className="text-amber-700 mt-0.5">
                    Đánh giá không xuất hiện trên trang đặt lịch công khai và danh sách phản hồi khách hàng.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Nội dung đánh giá đang hiển thị công khai</p>
                  <p className="text-emerald-700 mt-0.5">
                    Đánh giá xuất hiện trên trang phòng khám và widget độ uy tín để tạo niềm tin cho bệnh nhân mới.
                  </p>
                </div>
              </div>
            )}

            {isRatingHidden ? (
              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-start gap-2 text-xs text-purple-900 leading-relaxed">
                <EyeOff className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Điểm sao ({rating}★) đang bị ẨN:</span> Điểm này không xuất hiện công khai và không tính vào điểm sao trung bình của phòng khám.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Điểm sao ({rating}★) đang HIỆN:</span> Điểm sao được hiển thị và tính vào điểm trung bình uy tín của dịch vụ/phòng khám.
                </div>
              </div>
            )}
          </div>

          {/* Delete confirmation dialog */}
          {confirmDelete && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-2 text-rose-800 text-xs">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold text-rose-900">Xác nhận xóa đánh giá?</p>
                  <p className="mt-0.5">
                    Số sao và nhận xét của bệnh nhân sẽ bị xóa hoàn toàn. Trạng thái lịch hẹn vẫn giữ "Hoàn thành".
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-rose-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={loadingAction === 'delete'}
                  onClick={handleDeleteReview}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Xác nhận xóa vĩnh viễn
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            disabled={loadingAction === 'delete'}
            onClick={() => setConfirmDelete(true)}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa</span>
          </button>

          <div className="w-full sm:w-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onEditReview(appointment);
                onClose();
              }}
              className="px-3 py-2 text-xs font-bold rounded-xl text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Sửa</span>
            </button>

            {/* Nút Ẩn / Hiện Điểm Sao */}
            <button
              type="button"
              disabled={loadingAction === 'toggle-rating'}
              onClick={handleToggleRatingVisibility}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                isRatingHidden
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300'
              }`}
            >
              {loadingAction === 'toggle-rating' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Star className={`w-3.5 h-3.5 ${isRatingHidden ? 'fill-white text-white' : 'text-purple-600'}`} />
              )}
              <span>{isRatingHidden ? 'Hiện điểm sao' : 'Ẩn điểm sao'}</span>
            </button>

            {/* Nút Ẩn / Hiện Toàn Bộ Đánh Giá */}
            <button
              type="button"
              disabled={loadingAction === 'toggle'}
              onClick={handleToggleVisibility}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                isHidden
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {loadingAction === 'toggle' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isHidden ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span>{isHidden ? 'Hiện đánh giá' : 'Ẩn đánh giá'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
