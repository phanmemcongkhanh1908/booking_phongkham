import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Edit, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink, 
  FileSpreadsheet, 
  HardDrive,
  Info,
  RefreshCw,
  Layers,
  Users,
  CheckCircle2,
  X
} from 'lucide-react';
import api from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export interface ClinicGoogleAccount {
  id: string;
  clinicName: string;
  doctorName: string;
  email: string;
  phone?: string;
  notes?: string;
  status: 'active' | 'pending' | 'disabled';
  createdAt: string;
  updatedAt?: string;
}

export const ClinicGoogleAccountsManager: React.FC = () => {
  const [accounts, setAccounts] = useState<ClinicGoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Single form state
  const [formEmail, setFormEmail] = useState('');
  const [formClinicName, setFormClinicName] = useState('');
  const [formDoctorName, setFormDoctorName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'pending' | 'disabled'>('active');

  // Batch form state
  const [batchEmails, setBatchEmails] = useState('');
  const [batchClinicName, setBatchClinicName] = useState('');

  // UI feedback
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/google-sync-accounts');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAccounts(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load clinic google accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormEmail('');
    setFormClinicName('');
    setFormDoctorName('');
    setFormPhone('');
    setFormNotes('');
    setFormStatus('active');
    setActionMsg(null);
    setShowSingleModal(true);
  };

  const handleOpenEdit = (acc: ClinicGoogleAccount) => {
    setModalMode('edit');
    setEditingId(acc.id);
    setFormEmail(acc.email);
    setFormClinicName(acc.clinicName || '');
    setFormDoctorName(acc.doctorName || '');
    setFormPhone(acc.phone || '');
    setFormNotes(acc.notes || '');
    setFormStatus(acc.status || 'active');
    setActionMsg(null);
    setShowSingleModal(true);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formEmail.includes('@')) {
      setActionMsg({ type: 'error', text: 'Vui lòng nhập địa chỉ Gmail hợp lệ' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/google-sync-accounts', {
          email: formEmail,
          clinicName: formClinicName,
          doctorName: formDoctorName,
          phone: formPhone,
          notes: formNotes
        });
        if (res.data?.success) {
          setActionMsg({ type: 'success', text: 'Đã thêm tài khoản Gmail vào CSDL thành công!' });
          fetchAccounts();
          setTimeout(() => setShowSingleModal(false), 1200);
        }
      } else if (editingId) {
        const res = await api.put(`/admin/google-sync-accounts/${editingId}`, {
          email: formEmail,
          clinicName: formClinicName,
          doctorName: formDoctorName,
          phone: formPhone,
          notes: formNotes,
          status: formStatus
        });
        if (res.data?.success) {
          setActionMsg({ type: 'success', text: 'Cập nhật thông tin Gmail thành công!' });
          fetchAccounts();
          setTimeout(() => setShowSingleModal(false), 1200);
        }
      }
    } catch (err: any) {
      setActionMsg({ 
        type: 'error', 
        text: err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra khi lưu' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchEmails.trim()) {
      setActionMsg({ type: 'error', text: 'Vui lòng dán danh sách email' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/admin/google-sync-accounts/batch', {
        emailsText: batchEmails,
        defaultClinicName: batchClinicName
      });
      if (res.data?.success) {
        setActionMsg({ 
          type: 'success', 
          text: `Đã nhập thành công ${res.data.addedCount} tài khoản Gmail mới vào CSDL!` 
        });
        fetchAccounts();
        setTimeout(() => {
          setShowBatchModal(false);
          setBatchEmails('');
          setBatchClinicName('');
        }, 1500);
      }
    } catch (err: any) {
      setActionMsg({ 
        type: 'error', 
        text: err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi khi nhập hàng loạt' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${email}" khỏi danh sách CSDL?`)) return;
    try {
      await api.delete(`/admin/google-sync-accounts/${id}`);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Không thể xóa tài khoản');
    }
  };

  const handleCopyAllEmails = () => {
    if (accounts.length === 0) return;
    const emailsList = accounts.map(a => a.email).join(', ');
    navigator.clipboard.writeText(emailsList);
    setCopyAllSuccess(true);
    setTimeout(() => setCopyAllSuccess(false), 2500);
  };

  const handleCopySingleEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const filteredAccounts = accounts.filter(acc => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.email.toLowerCase().includes(q) ||
      acc.clinicName.toLowerCase().includes(q) ||
      (acc.doctorName && acc.doctorName.toLowerCase().includes(q)) ||
      (acc.notes && acc.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner explaining Google OAuth In Production & Test Users */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1 text-xs text-slate-700">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Cơ chế xác thực Google OAuth & Đồng bộ CSDL</span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Dự án đã ở chế độ In Production
                </span>
              </h3>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:text-teal-900 font-semibold underline inline-flex items-center gap-1"
              >
                Google Cloud Console
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white/90 border border-emerald-200">
                <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  1. Khi đăng nhập gặp thông báo "Ứng dụng chưa được xác minh":
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Vì trạng thái dự án của bạn là <strong>In production</strong> (cho phép 100 người dùng tự do), người dùng <strong>không bị chặn</strong>. Khi hiện popup cảnh báo màu vàng, chỉ cần bấm <strong>"Nâng cao" (Advanced)</strong> ➔ chọn <strong>"Đi tới booking-phongkham (không an toàn)"</strong> ➔ bấm <strong>"Tiếp tục"</strong> là kết nối thành công.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/90 border border-indigo-200">
                <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-indigo-800">
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  2. Quản lý danh sách Gmail phòng khám tại CSDL này:
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Admin tổng có thể lưu trữ toàn bộ Gmail của các phòng khám tại đây để kiểm soát việc uỷ quyền. Bạn có thể bấm nút <strong>"Sao chép tất cả email"</strong> để dán 1 lần vào mục <em>Test Users</em> trên Google Cloud bất cứ khi nào cần.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-600" />
            Danh sách Gmail phòng khám (Google Sync Accounts)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tài khoản Google Drive & Google Sheets được cấp phép sao lưu dữ liệu cho từng phòng khám.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {accounts.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyAllEmails}
              className="border-slate-300 text-xs gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
              title="Sao chép toàn bộ email để dán nhanh vào Test Users trên Google Cloud Console"
            >
              {copyAllSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã sao chép tất cả!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sao chép tất cả Gmail ({accounts.length})</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setBatchEmails('');
              setBatchClinicName('');
              setActionMsg(null);
              setShowBatchModal(true);
            }}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5 font-semibold"
          >
            <Layers className="w-3.5 h-3.5" />
            Thêm hàng loạt
          </Button>

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm Gmail phòng khám
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Gmail, tên phòng khám, bác sĩ..."
            className="pl-9 text-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium ml-auto">
          Tổng số: <strong className="text-slate-800 font-bold">{filteredAccounts.length}</strong> tài khoản
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-xs text-slate-500 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Đang tải danh sách Gmail từ CSDL...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Chưa có Gmail phòng khám nào trong CSDL</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Bấm vào nút <strong>"Thêm Gmail phòng khám"</strong> hoặc <strong>"Thêm hàng loạt"</strong> ở trên để thêm các tài khoản như <code className="text-teal-700 font-mono">giamdinhphapy.tg@gmail.com</code>, <code className="text-teal-700 font-mono">lamvideoai1908@gmail.com</code>.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleOpenCreate}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm tài khoản đầu tiên
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Địa chỉ Gmail</th>
                  <th className="py-3 px-4">Phòng khám / Bác sĩ</th>
                  <th className="py-3 px-4">Số điện thoại & Ghi chú</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 border border-red-100">
                          G
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 font-mono flex items-center gap-1.5">
                            <span>{acc.email}</span>
                            <button
                              type="button"
                              onClick={() => handleCopySingleEmail(acc.id, acc.email)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                              title="Sao chép email này"
                            >
                              {copiedEmailId === acc.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Ngày tạo: {new Date(acc.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{acc.clinicName || 'Chưa đặt tên phòng khám'}</div>
                      {acc.doctorName && (
                        <div className="text-[11px] text-teal-700 font-medium">BS: {acc.doctorName}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {acc.phone && (
                        <div className="font-mono text-slate-700">{acc.phone}</div>
                      )}
                      <div className="text-[11px] text-slate-500 italic max-w-xs truncate">
                        {acc.notes || '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {acc.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Tạm dừng
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(acc)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(acc.id, acc.email)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa khỏi CSDL"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Single Create / Edit */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {modalMode === 'create' ? 'Thêm Gmail phòng khám vào CSDL' : 'Chỉnh sửa tài khoản Gmail'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSingleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">
                  Địa chỉ Gmail quản trị phòng khám <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ví dụ: giamdinhphapy.tg@gmail.com"
                  required
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Email này sẽ được cấp quyền uỷ quyền Google Drive và Google Sheets cho phòng khám.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Tên phòng khám</label>
                  <Input
                    value={formClinicName}
                    onChange={(e) => setFormClinicName(e.target.value)}
                    placeholder="Ví dụ: Nha Khoa Sài Gòn"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Bác sĩ phụ trách</label>
                  <Input
                    value={formDoctorName}
                    onChange={(e) => setFormDoctorName(e.target.value)}
                    placeholder="Ví dụ: BS. Nguyễn Văn A"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Số điện thoại liên hệ</label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0901234567"
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Trạng thái tài khoản</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  >
                    <option value="active">Hoạt động (Được kết nối)</option>
                    <option value="disabled">Tạm dừng</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">Ghi chú thêm</label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú cơ sở, chi nhánh hoặc thỏa thuận riêng..."
                  className="text-xs"
                />
              </div>

              {actionMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {actionMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                  <span>{actionMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSingleModal(false)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4"
                >
                  {isSubmitting ? 'Đang lưu...' : (modalMode === 'create' ? 'Lưu vào CSDL' : 'Cập nhật')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Batch Import */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Thêm hàng loạt Gmail phòng khám
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">
                  Dán danh sách Gmail (phân cách bằng dấu phẩy, khoảng trắng hoặc xuống dòng) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={batchEmails}
                  onChange={(e) => setBatchEmails(e.target.value)}
                  placeholder={`giamdinhphapy.tg@gmail.com\nlamvideoai1908@gmail.com\nbs.hung.dental@gmail.com`}
                  required
                  className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-500">
                  Hệ thống sẽ tự động lọc các email hợp lệ và loại bỏ các email đã trùng lặp trong CSDL.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">Tên phòng khám mặc định (Tùy chọn)</label>
                <Input
                  value={batchClinicName}
                  onChange={(e) => setBatchClinicName(e.target.value)}
                  placeholder="Ví dụ: Hệ thống Nha Khoa Đối Tác"
                  className="text-xs"
                />
              </div>

              {actionMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {actionMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                  <span>{actionMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBatchModal(false)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4"
                >
                  {isSubmitting ? 'Đang thêm...' : 'Lưu tất cả vào CSDL'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicGoogleAccountsManager;
