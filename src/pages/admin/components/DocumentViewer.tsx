import React, { useState, useRef, useEffect } from 'react';
import { ReceiptTemplate, K80ReceiptTemplate, MedicalRecordTemplate } from './PrintTemplates';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../../../services/api';
import { Printer, Send, X, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receipt' | 'record';
  patient: any;
  records?: any[];
  receiptData?: {
    total: number;
    paid: number;
    newDebt: number;
    oldDebt: number;
  };
  onSendSuccess?: (telegramId: string) => void;
}

export default function DocumentViewer({
  isOpen,
  onClose,
  type,
  patient,
  records = [],
  receiptData = { total: 0, paid: 0, newDebt: 0, oldDebt: 0 },
  onSendSuccess
}: DocumentViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showTelegramUi, setShowTelegramUi] = useState(false);
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [telegramFormat, setTelegramFormat] = useState<'png' | 'pdf'>('pdf');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState('');
  const [printFormat, setPrintFormat] = useState<'a5' | 'k80'>('a5');

  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && patient?.telegramId) {
      setTelegramIdInput(patient.telegramId);
    }
    if (isOpen) {
      setShowTelegramUi(false);
      setTelegramSuccess('');
    }
  }, [isOpen, patient]);

  // Handle printing
  useEffect(() => {
    if (isPrinting) {
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    }
  }, [isPrinting]);

  if (!isOpen || !patient) return null;

  const handlePrint = () => {
    setIsPrinting(true);
  };

  const handleSendTelegram = async () => {
    if (!telegramIdInput.trim()) {
      alert("Vui lòng nhập Username hoặc Chat ID Telegram");
      return;
    }
    
    setSendingTelegram(true);
    setTelegramSuccess('');
    
    try {
      if (!targetRef.current) return;
      
      // Temporarily show it correctly for html2canvas
      targetRef.current.style.left = '0';
      targetRef.current.style.top = '0';
      targetRef.current.style.zIndex = '-100';
      
      const canvas = await html2canvas(targetRef.current, { scale: 2 });
      
      let base64Data = '';
      let filename = '';
      
      if (telegramFormat === 'png') {
        base64Data = canvas.toDataURL('image/png');
        filename = type === 'receipt' ? 'Phieu_Thu.png' : 'Ho_So_Benh_An.png';
      } else {
        let pdfFormat: any = type === 'receipt' ? 'a5' : 'a4';
        if (type === 'receipt' && printFormat === 'k80') {
          // K80 is 80mm width. Height depends on canvas ratio.
          const ratio = canvas.height / canvas.width;
          pdfFormat = [80, 80 * ratio];
        }
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: pdfFormat
        });
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        base64Data = pdf.output('datauristring');
        filename = type === 'receipt' ? 'Phieu_Thu.pdf' : 'Ho_So_Benh_An.pdf';
      }
      
      // Re-hide
      targetRef.current.style.left = '-9999px';
      targetRef.current.style.top = '-9999px';

      const caption = type === 'receipt' 
        ? `Phiếu thu của bệnh nhân ${patient.fullName}` 
        : `Hồ sơ bệnh án của bệnh nhân ${patient.fullName}`;

      const res = await api.post(`/patients/${patient.id}/send-document`, {
        telegramId: telegramIdInput,
        base64Data,
        filename,
        caption
      });

      if (res.data.success) {
        setTelegramSuccess('Gửi thành công qua Telegram!');
        if (onSendSuccess) {
          onSendSuccess(telegramIdInput);
        }
        setTimeout(() => {
          setShowTelegramUi(false);
          setTelegramSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error?.message || "Có lỗi khi gửi Telegram.");
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex print:hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
        
        {/* Modal Container */}
        <div className="relative w-full max-w-5xl m-auto bg-bg-base rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header Toolbar */}
          <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-main">
                  {type === 'receipt' ? 'Phiếu Thu' : 'Hồ Sơ Bệnh Án'}
                </h2>
                <p className="text-sm text-text-muted">
                  Bệnh nhân: {patient.fullName} - {patient.id?.slice(0,6).toUpperCase()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {type === 'receipt' && (
                <div className="flex bg-slate-100 p-1 rounded-md">
                  <button onClick={() => setPrintFormat('a5')} className={`px-3 py-1.5 text-xs font-medium rounded ${printFormat === 'a5' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}>A5 (Chuẩn)</button>
                  <button onClick={() => setPrintFormat('k80')} className={`px-3 py-1.5 text-xs font-medium rounded ${printFormat === 'k80' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}>K80 (Máy in bill)</button>
                </div>
              )}
              <Button variant="outline" onClick={handlePrint} className="gap-2 bg-white hidden sm:flex">
                <Printer className="w-4 h-4" />
                In tài liệu
              </Button>
              <Button onClick={() => setShowTelegramUi(!showTelegramUi)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="w-4 h-4" />
                Gửi Telegram
              </Button>
              <div className="w-px h-6 bg-border-subtle mx-2"></div>
              <button onClick={onClose} className="p-2 text-text-muted hover:bg-bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Document Preview Area (Scaled wrapper) */}
            <div className="flex-1 overflow-auto bg-slate-200/50 p-4 md:p-8 flex justify-center custom-scrollbar">
              <div className="relative shadow-lg border border-slate-200" style={{ transformOrigin: 'top center' }}>
                {type === 'receipt' ? (
                  printFormat === 'a5' ? (
                    <ReceiptTemplate 
                      forPrint={true} 
                      patient={patient}
                      total={receiptData.total}
                      paid={receiptData.paid}
                      newDebt={receiptData.newDebt}
                      oldDebt={receiptData.oldDebt}
                    />
                  ) : (
                    <div className="bg-white max-w-sm mx-auto">
                      <K80ReceiptTemplate 
                        forPrint={true} 
                        patient={patient}
                        total={receiptData.total}
                        paid={receiptData.paid}
                        newDebt={receiptData.newDebt}
                        oldDebt={receiptData.oldDebt}
                      />
                    </div>
                  )
                ) : (
                  <MedicalRecordTemplate 
                    forPrint={true}
                    patient={patient}
                    records={records}
                  />
                )}
              </div>
            </div>

            {/* Telegram Sidebar (Optional) */}
            {showTelegramUi && (
              <div className="w-full md:w-80 bg-surface border-l border-border-subtle shrink-0 flex flex-col animate-in slide-in-from-right-8 duration-300">
                <div className="p-5 border-b border-border-subtle">
                  <h3 className="font-bold text-text-main flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-500" />
                    Gửi tài liệu
                  </h3>
                </div>
                <div className="p-5 space-y-6 flex-1 overflow-auto">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-text-main block">Tài khoản Telegram</label>
                    <Input 
                      value={telegramIdInput} 
                      onChange={e => setTelegramIdInput(e.target.value)} 
                      placeholder="VD: @username hoặc Chat ID" 
                      className="bg-bg-base text-sm" 
                    />
                    <p className="text-xs text-text-muted leading-relaxed">
                      Nhập Username (có @) hoặc Chat ID của khách hàng để gửi file trực tiếp.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-text-main block">Định dạng file đính kèm</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${telegramFormat === 'pdf' ? 'border-primary bg-primary/5 text-primary' : 'border-border-subtle text-text-muted hover:border-primary/30'}`}>
                        <input type="radio" name="format" value="pdf" checked={telegramFormat === 'pdf'} onChange={() => setTelegramFormat('pdf')} className="sr-only" />
                        <span className="font-bold text-sm mb-1">PDF</span>
                        <span className="text-[10px] text-center">In chuẩn khổ {type === 'receipt' ? (printFormat === 'a5' ? 'A5' : 'K80') : 'A4'}</span>
                      </label>
                      <label className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${telegramFormat === 'png' ? 'border-primary bg-primary/5 text-primary' : 'border-border-subtle text-text-muted hover:border-primary/30'}`}>
                        <input type="radio" name="format" value="png" checked={telegramFormat === 'png'} onChange={() => setTelegramFormat('png')} className="sr-only" />
                        <span className="font-bold text-sm mb-1">Hình ảnh</span>
                        <span className="text-[10px] text-center">Định dạng PNG</span>
                      </label>
                    </div>
                  </div>

                  {telegramSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-green-700 text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{telegramSuccess}</p>
                    </div>
                  )}
                </div>
                <div className="p-5 border-t border-border-subtle bg-bg-base">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" 
                    onClick={handleSendTelegram} 
                    disabled={sendingTelegram}
                  >
                    {sendingTelegram ? 'Đang gửi...' : 'Xác nhận Gửi'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Templates for html2canvas to capture correctly without flexbox/scaling issues */}
      <div className="print:hidden">
        {type === 'receipt' ? (
          printFormat === 'a5' ? (
            <ReceiptTemplate 
              ref={targetRef}
              patient={patient}
              total={receiptData.total}
              paid={receiptData.paid}
              newDebt={receiptData.newDebt}
              oldDebt={receiptData.oldDebt}
            />
          ) : (
            <K80ReceiptTemplate 
              ref={targetRef}
              patient={patient}
              total={receiptData.total}
              paid={receiptData.paid}
              newDebt={receiptData.newDebt}
              oldDebt={receiptData.oldDebt}
            />
          )
        ) : (
          <MedicalRecordTemplate 
            ref={targetRef}
            patient={patient}
            records={records}
          />
        )}
      </div>

      {/* Actual Print Rendering (Only visible to the browser print engine) */}
      {isPrinting && (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white z-[9999]">
          {type === 'receipt' ? (
            printFormat === 'a5' ? (
              <ReceiptTemplate 
                forPrint={true} 
                patient={patient}
                total={receiptData.total}
                paid={receiptData.paid}
                newDebt={receiptData.newDebt}
                oldDebt={receiptData.oldDebt}
              />
            ) : (
              <K80ReceiptTemplate 
                forPrint={true} 
                patient={patient}
                total={receiptData.total}
                paid={receiptData.paid}
                newDebt={receiptData.newDebt}
                oldDebt={receiptData.oldDebt}
              />
            )
          ) : (
            <MedicalRecordTemplate 
              forPrint={true}
              patient={patient}
              records={records}
            />
          )}
        </div>
      )}
    </>
  );
}
