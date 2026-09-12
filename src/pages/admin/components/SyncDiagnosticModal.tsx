import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle2, Server, FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import api from '../../../services/api';
import { useGoogleAuthStore } from '../../../store/googleAuthStore';
import { fetchAppointmentsFromSheet, syncAppointmentsToSheet, findOrCreateClinicSpreadsheet } from '../../../lib/googleWorkspace';

interface Props {
  onClose: () => void;
  onForceSyncAll: () => Promise<void>;
}

export default function SyncDiagnosticModal({ onClose, onForceSyncAll }: Props) {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    totalDb: number;
    totalSheet: number;
    conflicts: any[];
    missingInSheet: any[];
    orphanedInSheet: any[];
    duplicatesInSheet: any[];
  } | null>(null);

  const { accessToken: googleToken, spreadsheetId, setSpreadsheetInfo } = useGoogleAuthStore();

  useEffect(() => {
    runDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    if (!googleToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch from DB
      const dbRes = await api.get('/appointments');
      const dbAppts = dbRes.data?.data || [];

      // 2. Fetch from Google Sheets
      let targetSheetId = spreadsheetId;
      if (!targetSheetId) {
        const sheetInfo = await findOrCreateClinicSpreadsheet(googleToken, 'Dental Smart');
        targetSheetId = sheetInfo.spreadsheetId;
        setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
      }

      const sheetRows = await fetchAppointmentsFromSheet(googleToken, targetSheetId!);
      // Typically row 0 is header. Let's find rows that look like data
      const dataRows = sheetRows.filter((r, i) => i > 0 && r[0]); 

      const dbMap = new Map();
      dbAppts.forEach((a: any) => dbMap.set(a.id, a));

      const sheetMap = new Map();
      const duplicates: any[] = [];

      dataRows.forEach((row, index) => {
        const id = row[0];
        if (sheetMap.has(id)) {
          duplicates.push({ rowNumber: index + 2, id, data: row });
        } else {
          sheetMap.set(id, { rowNumber: index + 2, data: row });
        }
      });

      const missingInSheet: any[] = [];
      const conflicts: any[] = [];
      const orphanedInSheet: any[] = [];

      const formatStatus = (s: string) => {
        switch (s) {
          case 'REQUESTED': return 'Chờ duyệt';
          case 'PENDING': return 'Đang xử lý';
          case 'CONFIRMED': return 'Đã xác nhận';
          case 'CHECKED_IN': return 'Đã đến khám';
          case 'COMPLETED': return 'Hoàn thành';
          case 'CANCELLED': return 'Đã hủy';
          case 'NO_SHOW': return 'Vắng mặt';
          default: return s || 'Chờ duyệt';
        }
      };

      // Check DB -> Sheet
      for (const dbAppt of dbAppts) {
        if (!sheetMap.has(dbAppt.id)) {
          missingInSheet.push(dbAppt);
        } else {
          // Check for conflicts (e.g., status mismatch)
          const sheetApt = sheetMap.get(dbAppt.id);
          const dbStatus = formatStatus(dbAppt.status);
          const sheetStatus = sheetApt.data[6] || '';
          
          if (dbStatus !== sheetStatus) {
            conflicts.push({
              id: dbAppt.id,
              patientName: dbAppt.patient?.fullName || dbAppt.patientName,
              dbStatus,
              sheetStatus
            });
          }
        }
      }

      // Check Sheet -> DB
      for (const [id, sheetApt] of sheetMap.entries()) {
        if (!dbMap.has(id)) {
          orphanedInSheet.push({ id, ...sheetApt });
        }
      }

      setDiagnosticData({
        totalDb: dbAppts.length,
        totalSheet: sheetMap.size,
        conflicts,
        missingInSheet,
        orphanedInSheet,
        duplicatesInSheet: duplicates
      });

    } catch (err) {
      console.error('Error running diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    await onForceSyncAll();
    await runDiagnostic();
    setIsSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Chẩn đoán Đồng bộ Dữ liệu</h3>
              <p className="text-xs text-slate-500 font-medium">Đối chiếu dữ liệu giữa Máy chủ (Neon) và Bảng tính (Google Sheets)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-slate-50/30 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Đang quét và đối chiếu dữ liệu...</p>
            </div>
          ) : !diagnosticData ? (
            <div className="text-center py-10 text-rose-600">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-semibold">Lỗi khi lấy dữ liệu chẩn đoán.</p>
              <p className="text-xs mt-1">Vui lòng kiểm tra lại kết nối mạng hoặc quyền truy cập Google Drive.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
                  <Server className="w-6 h-6 text-blue-600 mb-2" />
                  <span className="text-3xl font-bold text-slate-800">{diagnosticData.totalDb}</span>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Lịch hẹn trên Neon DB</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 mb-2" />
                  <span className="text-3xl font-bold text-slate-800">{diagnosticData.totalSheet}</span>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Hàng trên Google Sheets</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col items-center text-center bg-amber-50/50">
                  <AlertTriangle className="w-6 h-6 text-amber-600 mb-2" />
                  <span className="text-3xl font-bold text-amber-700">
                    {diagnosticData.conflicts.length + diagnosticData.missingInSheet.length}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mt-1">Lệch & Chưa đồng bộ</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex flex-col items-center text-center bg-rose-50/50">
                  <RefreshCw className="w-6 h-6 text-rose-600 mb-2" />
                  <span className="text-3xl font-bold text-rose-700">
                    {diagnosticData.orphanedInSheet.length + diagnosticData.duplicatesInSheet.length}
                  </span>
                  <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide mt-1">Dư thừa & Trùng lặp</span>
                </div>
              </div>

              {/* Detailed Diagnostics */}
              <div className="space-y-4">
                
                {/* Missing in Sheets */}
                {diagnosticData.missingInSheet.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Có {diagnosticData.missingInSheet.length} lịch hẹn trên hệ thống chưa có trên Google Sheets
                      </h4>
                    </div>
                    <div className="p-0 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-[13px] text-slate-700">
                        <thead className="bg-slate-50 sticky top-0 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-y border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Bệnh nhân</th>
                            <th className="py-2.5 px-4">Trạng thái</th>
                            <th className="py-2.5 px-4">Giờ khám</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {diagnosticData.missingInSheet.slice(0, 50).map((apt, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-4 font-medium text-slate-800">{apt.patientName || apt.patient?.fullName || 'Khách vãng lai'}</td>
                              <td className="py-2.5 px-4 border-b border-slate-100"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium text-[10px]">{apt.status}</span></td>
                              <td className="py-2 px-4 text-slate-500">{new Date(apt.startAt).toLocaleString('vi-VN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {diagnosticData.missingInSheet.length > 50 && (
                        <div className="py-2 text-center text-xs text-slate-500 border-t">
                          Và {diagnosticData.missingInSheet.length - 50} dòng khác...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Conflicts */}
                {diagnosticData.conflicts.length > 0 && (
                  <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2 border-b border-orange-100 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Có {diagnosticData.conflicts.length} lịch hẹn bị lệch trạng thái
                      </h4>
                    </div>
                    <div className="p-0 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-[13px] text-slate-700">
                        <thead className="bg-slate-50 sticky top-0 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-y border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Bệnh nhân</th>
                            <th className="py-2.5 px-4">Trạng thái (Hệ thống)</th>
                            <th className="py-2.5 px-4">Trạng thái (Sheets)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {diagnosticData.conflicts.slice(0, 50).map((conflict, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-4 font-medium text-slate-800">{conflict.patientName || 'N/A'}</td>
                              <td className="py-2.5 px-4 border-b border-slate-100">
                                <span className="text-blue-700 font-semibold">{conflict.dbStatus}</span>
                              </td>
                              <td className="py-2.5 px-4 border-b border-slate-100">
                                <span className="text-orange-600 font-semibold line-through opacity-70 mr-1">{conflict.sheetStatus}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Duplicates / Orphaned */}
                {(diagnosticData.duplicatesInSheet.length > 0 || diagnosticData.orphanedInSheet.length > 0) && (
                  <div className="bg-white rounded-xl border border-rose-200 overflow-hidden">
                    <div className="bg-rose-50 px-4 py-2 border-b border-rose-100 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Phát hiện rác trên Google Sheets ({diagnosticData.duplicatesInSheet.length} trùng lặp, {diagnosticData.orphanedInSheet.length} dư thừa)
                      </h4>
                    </div>
                    <div className="p-4 text-xs text-slate-600">
                      Có dữ liệu không khớp mã trên Google Sheets. Bạn nên thực hiện "Làm mới toàn bộ đồng bộ hóa" để hệ thống xoá sạch bảng và chép lại dữ liệu chuẩn từ máy chủ.
                    </div>
                  </div>
                )}

                {/* All Good */}
                {diagnosticData.missingInSheet.length === 0 && diagnosticData.conflicts.length === 0 && diagnosticData.duplicatesInSheet.length === 0 && diagnosticData.orphanedInSheet.length === 0 && (
                  <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 flex flex-col items-center justify-center text-emerald-800 space-y-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    <h4 className="text-base font-bold">Dữ liệu đồng bộ hoàn hảo</h4>
                    <p className="text-sm text-emerald-600/80">Không phát hiện bất kỳ sự sai lệch nào giữa Máy chủ và Google Sheets.</p>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
          <p className="text-[11px] text-slate-500 max-w-sm leading-tight">
            Nếu phát hiện sai lệch, hãy sử dụng tính năng <strong>Làm mới đồng bộ</strong> để ghi đè toàn bộ dữ liệu từ hệ thống lên Google Sheets.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSyncing}>Đóng lại</Button>
            <Button 
              onClick={handleForceSync}
              disabled={isSyncing || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isSyncing ? 'Đang đồng bộ...' : 'Làm mới đồng bộ hóa (Đè Sheets)'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
