import React, { useState, useEffect, useRef } from 'react';
import { ReceiptTemplate, MedicalRecordTemplate } from './components/PrintTemplates';
import DocumentViewer from './components/DocumentViewer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { 
  Search, Save, Cloud, Link as LinkIcon, FileText, CheckCircle2, 
  Image as ImageIcon, Images, Plus, Printer, Paperclip, Calendar, 
  Trash2, ChevronRight, Stethoscope, Banknote, UserRound, Info, 
  UploadCloud, Eye, Download, X, AlertCircle, ZoomIn, ZoomOut, 
  RotateCw, CalendarPlus, FolderPlus, Clock, Phone, Mail, 
  ClipboardList, Receipt, CalendarClock, Check, Sparkles,
  Send, ExternalLink, ChevronLeft
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { uploadImageToDrive, syncPatientToSheet, findOrCreateFolder, findOrCreateClinicSpreadsheet } from '../../lib/googleWorkspace';
import { useGoogleAuthStore } from '../../store/googleAuthStore';


// Document structure
export interface DocumentFile {
  name: string;
  url: string;
  size?: string;
  type?: string;
  uploadedAt?: string;
}

export interface DocumentGroup {
  id: string;
  date: string; // YYYY-MM-DD
  title?: string;
  note?: string;
  files: DocumentFile[];
}

export interface ParsedNotes {
  text: string;
  diagnosis?: string;
  treatmentPlan?: string;
  documents: DocumentGroup[];
}

// Utility to parse notes field (supports JSON and legacy text)
function parseNotes(rawNotes: string | null | undefined): ParsedNotes {
  if (!rawNotes) return { text: '', diagnosis: '', treatmentPlan: '', documents: [] };
  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === 'object') {
      const rawDocs = Array.isArray(parsed.documents) ? parsed.documents : [];
      const normalizedDocs: DocumentGroup[] = rawDocs.map((group: any, idx: number) => ({
        id: group.id || `group-${group.date || 'unknown'}-${idx}`,
        date: group.date || new Date().toISOString().split('T')[0],
        title: group.title || '',
        note: group.note || '',
        files: Array.isArray(group.files) ? group.files : []
      }));
      return {
        text: parsed.text || '',
        diagnosis: parsed.diagnosis || '',
        treatmentPlan: parsed.treatmentPlan || '',
        documents: normalizedDocs
      };
    }
  } catch (e) {
    // Legacy plain text
  }
  return { text: rawNotes, diagnosis: '', treatmentPlan: '', documents: [] };
}

// Read file as base64 data URL for local storage fallback
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // For large images, we can scale them down slightly to save storage
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL(file.type || 'image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'has_docs'>('all');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { 
    accessToken: googleAccessToken, 
    connect: connectGoogleStore, 
    spreadsheetId, 
    spreadsheetUrl, 
    setSpreadsheetInfo 
  } = useGoogleAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'finance' | 'appointments'>('overview');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  
  // EMR Form State
  const [debt, setDebt] = useState<number>(0);
  const [allergies, setAllergies] = useState<string>('');
  const [lastXRayDate, setLastXRayDate] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatmentPlan, setTreatmentPlan] = useState<string>('');
  const [notesText, setNotesText] = useState<string>('');
  const [documents, setDocuments] = useState<DocumentGroup[]>([]);
  const [isSaved, setIsSaved] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Modal: Create Upload Section by Date
  const [showCreateDateModal, setShowCreateDateModal] = useState(false);
  const [newSectionDate, setNewSectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newSectionTitle, setNewSectionTitle] = useState<string>('Chụp X-quang Panorama');
  const [newSectionNote, setNewSectionNote] = useState<string>('');
  const [newSectionFiles, setNewSectionFiles] = useState<File[]>([]);
  const newSectionFileInputRef = useRef<HTMLInputElement>(null);

  // Target date upload state (for uploading directly into an existing date group)
  const [targetGroupForUpload, setTargetGroupForUpload] = useState<string | null>(null);
  const targetGroupFileInputRef = useRef<HTMLInputElement>(null);

  // Quick upload file input
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox / Image Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string; date?: string; title?: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);

  const [documentViewerState, setDocumentViewerState] = useState<{isOpen: boolean, type: 'receipt' | 'record' | null}>({isOpen: false, type: null});


  // Billing State
  const [currentServiceCost, setCurrentServiceCost] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Tiền mặt');

  // New Patient State
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
    const savedSheetId = localStorage.getItem('emr_spreadsheet_id');
    if (savedSheetId && !spreadsheetId) {
      setSpreadsheetInfo(savedSheetId, `https://docs.google.com/spreadsheets/d/${savedSheetId}/edit`);
    }
  }, [spreadsheetId, setSpreadsheetInfo]);

  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients');
      if (res.data.success) {
        setPatients(res.data.data);
      }
    } catch (error) {
      toast.error('Lỗi khi tải danh sách bệnh nhân');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/admin/appointments');
      setAppointments(res.data.data || []);
    } catch (e) {
      console.warn('Could not fetch appointments for history');
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setDebt(patient.debt || 0);
    setAllergies(patient.allergies || '');
    setLastXRayDate(patient.lastXRayDate ? patient.lastXRayDate.split('T')[0] : '');
    
    const parsed = parseNotes(patient.notes);
    setNotesText(parsed.text);
    setDiagnosis(parsed.diagnosis || '');
    setTreatmentPlan(parsed.treatmentPlan || '');
    setDocuments(parsed.documents);
    
    setCurrentServiceCost(0);
    setPaidAmount(0);
    setPaymentMethod('Tiền mặt');
    setIsSaved(true);
    setActiveTab('overview');
    setMobileView('detail');
  };

  const handleConnectGoogle = async () => {
    try {
      const { accessToken } = await connectGoogleStore();
      toast.success("Kết nối Google Drive & Sheets thành công!");
      if (!spreadsheetId) {
        try {
          const sheetInfo = await findOrCreateClinicSpreadsheet(accessToken, 'Dental Smart');
          setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
        } catch (e) {
          console.warn('Auto create clinic spreadsheet warning:', e);
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Không thể kết nối Google: " + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleSaveEMR = async (silent = false) => {
    if (!selectedPatient) return;
    try {
      if (!silent) setLoading(true);
      const newDebt = Math.max(0, (debt + currentServiceCost) - paidAmount);
      
      const combinedNotes = JSON.stringify({
        text: notesText,
        diagnosis,
        treatmentPlan,
        documents: documents
      });

      await api.put(`/patients/${selectedPatient.id}`, {
        debt: newDebt,
        allergies,
        lastXRayDate: lastXRayDate || null,
        notes: combinedNotes
      });
      
      if (!silent) toast.success("Đã lưu toàn bộ hồ sơ bệnh án!");
      setIsSaved(true);
      fetchPatients();
      
      setDebt(newDebt);
      setCurrentServiceCost(0);
      setPaidAmount(0);
      
      if (googleAccessToken && !silent) {
        try {
          let targetSheetId = spreadsheetId;
          if (!targetSheetId) {
            const sheetInfo = await findOrCreateClinicSpreadsheet(googleAccessToken, 'Dental Smart');
            targetSheetId = sheetInfo.spreadsheetId;
            setSpreadsheetInfo(sheetInfo.spreadsheetId, sheetInfo.spreadsheetUrl);
          }
          if (targetSheetId) {
            await syncPatientToSheet({
              id: selectedPatient.id,
              fullName: selectedPatient.fullName,
              phone: selectedPatient.phone,
              debt: newDebt,
              allergies,
              lastXRayDate: lastXRayDate || 'Không có',
            }, googleAccessToken, targetSheetId);
            toast.success("Đã đồng bộ hồ sơ lên Google Sheets!");
          }
        } catch (syncError) {
          console.error(syncError);
          toast.error("Lỗi đồng bộ Google Sheets");
        }
      }
    } catch (error) {
      toast.error("Lỗi khi lưu hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  // Upload files handler
  const processFilesUpload = async (files: File[], targetDate: string, groupTitle?: string, groupNote?: string) => {
    if (!selectedPatient || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const newFilesList: DocumentFile[] = [];

    try {
      if (googleAccessToken) {
        // Upload to Google Drive with structured folder hierarchy
        const rootFolderId = await findOrCreateFolder('DentalSmart_EMR', googleAccessToken);
        const patientFolderName = `${selectedPatient.fullName} - ${selectedPatient.phone}`;
        const patientFolderId = await findOrCreateFolder(patientFolderName, googleAccessToken, rootFolderId);
        const dateFolderId = await findOrCreateFolder(targetDate, googleAccessToken, patientFolderId);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const driveUrl = await uploadImageToDrive(file, googleAccessToken, dateFolderId);
          newFilesList.push({
            name: file.name,
            url: driveUrl,
            size: formatFileSize(file.size),
            type: file.type,
            uploadedAt: new Date().toISOString()
          });
          setUploadProgress({ current: i + 1, total: files.length });
        }
      } else {
        // Fallback: Read as optimized Data URL for instant preview and local persistence
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const dataUrl = await readFileAsDataUrl(file);
          newFilesList.push({
            name: file.name,
            url: dataUrl,
            size: formatFileSize(file.size),
            type: file.type,
            uploadedAt: new Date().toISOString()
          });
          setUploadProgress({ current: i + 1, total: files.length });
        }
      }

      // Add to document groups
      const updatedDocs = [...documents];
      const existingGroupIndex = updatedDocs.findIndex(g => g.date === targetDate);

      if (existingGroupIndex >= 0) {
        updatedDocs[existingGroupIndex] = {
          ...updatedDocs[existingGroupIndex],
          title: groupTitle || updatedDocs[existingGroupIndex].title,
          note: groupNote || updatedDocs[existingGroupIndex].note,
          files: [...updatedDocs[existingGroupIndex].files, ...newFilesList]
        };
      } else {
        const newGroup: DocumentGroup = {
          id: `group-${Date.now()}`,
          date: targetDate,
          title: groupTitle || 'Đợt chụp & Tài liệu',
          note: groupNote || '',
          files: newFilesList
        };
        updatedDocs.unshift(newGroup);
      }

      // Sort groups by date descending
      updatedDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDocuments(updatedDocs);
      setIsSaved(false);

      // Save directly to server
      const combinedNotes = JSON.stringify({
        text: notesText,
        diagnosis,
        treatmentPlan,
        documents: updatedDocs
      });

      await api.put(`/patients/${selectedPatient.id}`, {
        debt: debt,
        allergies,
        lastXRayDate: targetDate > (lastXRayDate || '') ? targetDate : (lastXRayDate || null),
        notes: combinedNotes
      });

      if (targetDate > (lastXRayDate || '')) {
        setLastXRayDate(targetDate);
      }

      toast.success(`Đã tải lên ${newFilesList.length} tài liệu vào mục ngày ${new Date(targetDate).toLocaleDateString('vi-VN')}!`);
      fetchPatients();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi tải lên file: ' + (err.message || 'Thử lại'));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Submit modal "Tạo mục upload theo ngày"
  const handleCreateDateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionDate) {
      toast.error('Vui lòng chọn ngày!');
      return;
    }

    if (newSectionFiles.length === 0) {
      // Create empty date group
      const newGroup: DocumentGroup = {
        id: `group-${Date.now()}`,
        date: newSectionDate,
        title: newSectionTitle || 'Đợt khám & Chụp X-Quang',
        note: newSectionNote,
        files: []
      };

      const updatedDocs = [newGroup, ...documents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDocuments(updatedDocs);
      
      const combinedNotes = JSON.stringify({
        text: notesText,
        diagnosis,
        treatmentPlan,
        documents: updatedDocs
      });

      await api.put(`/patients/${selectedPatient.id}`, {
        debt,
        allergies,
        lastXRayDate: newSectionDate > (lastXRayDate || '') ? newSectionDate : (lastXRayDate || null),
        notes: combinedNotes
      });

      toast.success(`Đã tạo mục tài liệu cho ngày ${new Date(newSectionDate).toLocaleDateString('vi-VN')}!`);
      setShowCreateDateModal(false);
      setNewSectionFiles([]);
      setNewSectionNote('');
      return;
    }

    await processFilesUpload(newSectionFiles, newSectionDate, newSectionTitle, newSectionNote);
    setShowCreateDateModal(false);
    setNewSectionFiles([]);
    setNewSectionNote('');
  };

  // Quick upload (into today's date group)
  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const today = new Date().toISOString().split('T')[0];
    processFilesUpload(files, today, 'Tài liệu hôm nay');
    e.target.value = '';
  };

  // Upload into specific existing date group
  const handleUploadToTargetGroup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !targetGroupForUpload) return;
    const files = Array.from(e.target.files);
    const group = documents.find(g => g.id === targetGroupForUpload);
    const targetDate = group ? group.date : new Date().toISOString().split('T')[0];
    processFilesUpload(files, targetDate);
    e.target.value = '';
    setTargetGroupForUpload(null);
  };

  // Delete a single file
  const handleDeleteFile = async (groupId: string, fileUrl: string) => {
    if (!confirm("Bạn có chắc muốn xóa tài liệu này khỏi hồ sơ bệnh án?")) return;
    
    const updatedDocs = documents.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          files: group.files.filter(f => f.url !== fileUrl)
        };
      }
      return group;
    }).filter(g => g.files.length > 0 || g.note || g.title); // keep if has notes or title

    setDocuments(updatedDocs);
    setIsSaved(false);

    try {
      const combinedNotes = JSON.stringify({
        text: notesText,
        diagnosis,
        treatmentPlan,
        documents: updatedDocs
      });

      await api.put(`/patients/${selectedPatient.id}`, {
        debt,
        allergies,
        lastXRayDate: lastXRayDate || null,
        notes: combinedNotes
      });
      toast.success("Đã xóa tài liệu khỏi hồ sơ");
      fetchPatients();
    } catch (err) {
      toast.error("Lỗi khi lưu thay đổi");
    }
  };

  // Delete an entire date section
  const handleDeleteGroup = async (groupId: string, groupDate: string) => {
    if (!confirm(`Bạn có chắc muốn xóa toàn bộ mục ngày ${new Date(groupDate).toLocaleDateString('vi-VN')} cùng tất cả tài liệu trong mục này?`)) return;

    const updatedDocs = documents.filter(g => g.id !== groupId);
    setDocuments(updatedDocs);
    setIsSaved(false);

    try {
      const combinedNotes = JSON.stringify({
        text: notesText,
        diagnosis,
        treatmentPlan,
        documents: updatedDocs
      });

      await api.put(`/patients/${selectedPatient.id}`, {
        debt,
        allergies,
        lastXRayDate: lastXRayDate || null,
        notes: combinedNotes
      });
      toast.success("Đã xóa mục ngày và các tài liệu");
      fetchPatients();
    } catch (err) {
      toast.error("Lỗi khi xóa mục");
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientName || !newPatientPhone) {
      toast.error("Vui lòng nhập tên và số điện thoại");
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.post('/patients', {
        fullName: newPatientName,
        phone: newPatientPhone,
        email: newPatientEmail || undefined,
        dob: newPatientDob || undefined
      });
      
      if (res.data.success) {
        toast.success("Đã thêm bệnh nhân mới thành công!");
        setShowNewPatientModal(false);
        setNewPatientName('');
        setNewPatientPhone('');
        setNewPatientEmail('');
        setNewPatientDob('');
        await fetchPatients();
        handleSelectPatient(res.data.data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Lỗi khi tạo bệnh nhân (SĐT có thể đã tồn tại)");
    } finally {
      setLoading(false);
    }
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const matchesSearch = 
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.phone.includes(searchTerm);
    if (!matchesSearch) return false;

    if (filterType === 'debt') return (p.debt || 0) > 0;
    if (filterType === 'has_docs') {
      const parsed = parseNotes(p.notes);
      return parsed.documents && parsed.documents.some(d => d.files && d.files.length > 0);
    }
    return true;
  });

  // Patient appointments
  const patientAppointments = selectedPatient ? appointments.filter(a => 
    a.patientId === selectedPatient.id || a.phone === selectedPatient.phone
  ) : [];

  const totalFilesCount = documents.reduce((acc, curr) => acc + (curr.files ? curr.files.length : 0), 0);

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-105px)] bg-surface rounded-card overflow-hidden print:h-auto border border-border-subtle shadow-soft">
      
      {/* 1. SIDEBAR: Patient List */}
      <aside className={`w-full lg:w-84 border-b lg:border-b-0 lg:border-r border-border-subtle bg-bg-base flex flex-col print:hidden shrink-0 ${mobileView === 'detail' && selectedPatient ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border-subtle bg-surface">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-mint flex items-center justify-center text-primary font-bold">
                <UserRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-text-main text-sm">Danh bạ Bệnh nhân</h2>
                <p className="text-xs text-text-muted">{patients.length} bệnh nhân trong hệ thống</p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="h-8 px-2.5 rounded-lg text-xs gap-1.5 shadow-sm" 
              onClick={() => setShowNewPatientModal(true)}
              title="Thêm bệnh nhân mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm</span>
            </Button>
          </div>

          {/* Search input */}
          <div className="relative mb-2.5">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              className="pl-9 h-9 text-xs bg-bg-base border-border-subtle focus:bg-surface" 
              placeholder="Tìm tên hoặc số điện thoại..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-primary text-white font-semibold' : 'text-text-muted hover:bg-slate-200/60'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilterType('debt')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${filterType === 'debt' ? 'bg-error text-white font-semibold' : 'text-text-muted hover:bg-slate-200/60'}`}
            >
              Còn nợ
            </button>
            <button
              onClick={() => setFilterType('has_docs')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${filterType === 'has_docs' ? 'bg-primary text-white font-semibold' : 'text-text-muted hover:bg-slate-200/60'}`}
            >
              Có X-Quang
            </button>
          </div>
        </div>

        {/* Patient List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPatients.map(p => {
            const isSelected = selectedPatient?.id === p.id;
            const pDebt = p.debt || 0;
            const initial = p.fullName ? p.fullName.charAt(0).toUpperCase() : '?';

            return (
              <button
                key={p.id}
                onClick={() => handleSelectPatient(p)}
                className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center gap-3 border ${
                  isSelected 
                    ? 'bg-surface border-primary shadow-sm ring-1 ring-primary/20' 
                    : 'bg-surface/60 hover:bg-surface border-border-subtle hover:border-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isSelected ? 'bg-primary text-white' : 'bg-mint text-primary'
                }`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-text-main text-xs truncate">{p.fullName}</span>
                    {pDebt > 0 && (
                      <span className="text-[10px] font-bold text-error bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                        Nợ {(Number(pDebt) || 0).toLocaleString('vi-VN')} đ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted mt-0.5">
                    <span className="truncate">{p.phone}</span>
                    {p.lastXRayDate && (
                      <span className="text-[10px] text-primary flex items-center gap-0.5 shrink-0" title="Đã có phim X-quang">
                        <ImageIcon className="w-2.5 h-2.5" /> X-Q
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredPatients.length === 0 && (
            <div className="text-center py-12 px-4">
              <UserRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-text-muted">Không tìm thấy bệnh nhân nào</p>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-xs text-primary underline mt-1">
                  Xóa bộ lọc
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE: Patient EMR Details */}
      <main className={`flex-1 flex flex-col bg-surface min-w-0 overflow-hidden print:w-full ${mobileView === 'list' && selectedPatient ? 'hidden lg:flex' : 'flex'}`}>
        {selectedPatient ? (
          <>
            {/* Mobile Back to List Bar */}
            <div className="lg:hidden px-4 pt-3.5 pb-1 bg-surface border-b border-border-subtle flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-mint hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Danh bạ bệnh nhân</span>
              </button>
              <span className="text-xs text-text-muted font-medium">Hồ sơ bệnh án</span>
            </div>

            {/* Patient Overview Header Bar */}
            <div className="p-4 lg:px-6 lg:py-4 border-b border-border-subtle bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:border-none">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  {selectedPatient.fullName ? selectedPatient.fullName.charAt(0).toUpperCase() : 'BN'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold text-text-main">{selectedPatient.fullName}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      debt > 0 
                        ? 'bg-red-50 text-error border border-red-200' 
                        : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {debt > 0 ? `Công nợ: ${(Number(debt) || 0).toLocaleString('vi-VN')} đ` : 'Đã thanh toán đủ'}
                    </span>
                    {!isSaved && (
                      <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Chưa lưu
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-text-main">
                      <Phone className="w-3 h-3 text-text-muted" /> {selectedPatient.phone}
                    </span>
                    {selectedPatient.dob && (
                      <span>• SN: {new Date(selectedPatient.dob).toLocaleDateString('vi-VN')}</span>
                    )}
                    {selectedPatient.email && (
                      <span className="hidden sm:inline">• {selectedPatient.email}</span>
                    )}
                    {lastXRayDate && (
                      <span className="text-primary font-medium flex items-center gap-1">
                        • <ImageIcon className="w-3 h-3" /> X-Q gần nhất: {new Date(lastXRayDate).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end print:hidden flex-wrap">
                {!googleAccessToken ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-primary/40 text-primary hover:bg-mint text-xs h-9" 
                    onClick={handleConnectGoogle}
                    title="Đồng bộ file và sao lưu lên Google Drive của phòng khám"
                  >
                    <Cloud className="w-3.5 h-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Google</span> Drive
                  </Button>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200" title="Google Drive đã sẵn sàng lưu">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Drive OK
                  </span>
                )}
                
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDocumentViewerState({ isOpen: true, type: 'record' })}
                    className="text-xs h-9 bg-white"
                    title="In bệnh án"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    In bệnh án
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // setTelegramIdInput(selectedPatient.telegramId || '');
                      // setShowTelegramModal('record');
                    }}
                    className="text-xs h-9 text-blue-600 border-blue-200 hover:bg-blue-50 bg-white"
                    title="Gửi bệnh án qua Telegram"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Gửi Telegram
                  </Button>
                </div>


                <Button 
                  size="sm"
                  onClick={() => handleSaveEMR(false)} 
                  disabled={loading} 
                  className="text-xs h-9 shadow-sm gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu hồ sơ
                </Button>
              </div>
            </div>
            
            {/* EMR NAVIGATION TABS WITH UNIFIED ILLUSTRATIVE ICONS */}
            <div className="flex items-center border-b border-border-subtle px-4 lg:px-6 bg-bg-base/60 print:hidden overflow-x-auto whitespace-nowrap scrollbar-hide">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`py-3 px-4 text-xs font-bold flex items-center border-b-2 transition-all ${
                  activeTab === 'overview' 
                    ? 'border-primary text-primary bg-surface shadow-xs rounded-t-lg' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <ClipboardList className="w-4 h-4 mr-2 shrink-0 text-primary" />
                Khám & Bệnh lý
              </button>

              <button 
                onClick={() => setActiveTab('documents')}
                className={`py-3 px-4 text-xs font-bold flex items-center border-b-2 transition-all ${
                  activeTab === 'documents' 
                    ? 'border-primary text-primary bg-surface shadow-xs rounded-t-lg' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Images className="w-4 h-4 mr-2 shrink-0 text-primary" />
                X-Quang & Tài liệu theo ngày
                {totalFilesCount > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary font-black text-[11px] py-0.5 px-2 rounded-full">
                    {totalFilesCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('finance')}
                className={`py-3 px-4 text-xs font-bold flex items-center border-b-2 transition-all ${
                  activeTab === 'finance' 
                    ? 'border-primary text-primary bg-surface shadow-xs rounded-t-lg' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <Receipt className="w-4 h-4 mr-2 shrink-0 text-primary" />
                Chi phí & Thanh toán
                {debt > 0 && (
                  <span className="ml-2 bg-red-100 text-error font-bold text-[10px] py-0.5 px-1.5 rounded-full">
                    Nợ
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('appointments')}
                className={`py-3 px-4 text-xs font-bold flex items-center border-b-2 transition-all ${
                  activeTab === 'appointments' 
                    ? 'border-primary text-primary bg-surface shadow-xs rounded-t-lg' 
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                <CalendarClock className="w-4 h-4 mr-2 shrink-0 text-primary" />
                Lịch sử hẹn khám
                {patientAppointments.length > 0 && (
                  <span className="ml-2 bg-slate-200 text-text-main text-[11px] py-0.5 px-1.5 rounded-full">
                    {patientAppointments.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto bg-bg-base p-4 lg:p-6">
              
              {/* ======================================================== */}
              {/* TAB 1: KHÁM & BỆNH LÝ (OVERVIEW)                         */}
              {/* ======================================================== */}
              {activeTab === 'overview' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* General Medical History Card */}
                  <div className="bg-surface p-6 rounded-card border border-border-subtle shadow-soft">
                    <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
                      <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-primary" />
                        Tiền sử y khoa & Bệnh lý nền
                      </h3>
                      <span className="text-xs text-text-muted">Cảnh báo lâm sàng trước khi chỉ định thủ thuật</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-text-main block mb-1.5 text-error flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Dị ứng thuốc & Bệnh tim mạch, tiểu đường
                        </label>
                        <textarea 
                          className="w-full h-24 rounded-input border border-border-subtle bg-surface px-3.5 py-2.5 text-xs text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow resize-none"
                          placeholder="Ghi nhận dị ứng kháng sinh, tê lidocaine, thuốc chống đông, cao huyết áp, tim mạch..."
                          value={allergies}
                          onChange={e => {
                            setAllergies(e.target.value);
                            setIsSaved(false);
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-text-main block mb-1.5 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-primary" /> Ngày chụp X-Quang / Phim gần nhất
                        </label>
                        <Input 
                          type="date"
                          value={lastXRayDate}
                          onChange={e => {
                            setLastXRayDate(e.target.value);
                            setIsSaved(false);
                          }}
                          className="text-xs h-10 mb-2"
                        />
                        <p className="text-[11px] text-text-muted">
                          Tự động cập nhật khi bạn tải lên phim mới ở tab <b>X-Quang & Tài liệu</b>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis and Treatment Details */}
                  <div className="bg-surface p-6 rounded-card border border-border-subtle shadow-soft space-y-4">
                    <h3 className="text-base font-bold text-text-main flex items-center gap-2 border-b border-border-subtle pb-3">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      Chẩn đoán & Lộ trình điều trị
                    </h3>

                    <div>
                      <label className="text-xs font-bold text-text-main block mb-1.5">
                        Chẩn đoán nha khoa & Tình trạng răng miệng (Răng số, vôi răng, viêm tủy...)
                      </label>
                      <textarea 
                        className="w-full h-24 rounded-input border border-border-subtle bg-surface px-3.5 py-2.5 text-xs text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow resize-none"
                        placeholder="VD: R46 sâu ngà sâu sát tủy; R11, R21 mẻ góc cắn; Cao răng độ 2..."
                        value={diagnosis}
                        onChange={e => {
                          setDiagnosis(e.target.value);
                          setIsSaved(false);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-text-main block mb-1.5">
                        Kế hoạch điều trị & Ghi chú các đợt khám (Y bạ diễn tiến)
                      </label>
                      <textarea 
                        className="w-full h-32 rounded-input border border-border-subtle bg-surface px-3.5 py-2.5 text-xs text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow resize-none"
                        placeholder="VD: Buổi 1: Lấy vôi răng, mở tủy R46 đặt thuốc diệt tủy. Buổi 2 hẹn trám bít ống tủy..."
                        value={notesText}
                        onChange={e => {
                          setNotesText(e.target.value);
                          setIsSaved(false);
                        }}
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={() => handleSaveEMR(false)} disabled={loading} className="gap-2 text-xs">
                        <Save className="w-4 h-4" />
                        Lưu thông tin bệnh lý
                      </Button>
                    </div>
                  </div>

                  {/* Google Sheets Sync integration */}
                  <div className="bg-surface p-5 rounded-card border border-border-subtle shadow-soft">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-green-600" />
                        Đồng bộ hồ sơ Google Sheets
                      </h4>
                      {googleAccessToken ? (
                        <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          Đã kết nối
                        </span>
                      ) : (
                        <button onClick={handleConnectGoogle} className="text-xs text-primary font-semibold hover:underline">
                          Kết nối Google Drive/Sheets
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mb-3">
                      Tự động xuất bảng ghi hồ sơ bệnh nhân lên trang tính Google Drive của phòng khám.
                    </p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Nhập ID trang tính (Spreadsheet ID)..." 
                        value={spreadsheetId || ''}
                        onChange={e => {
                          const val = e.target.value.trim();
                          setSpreadsheetInfo(val, val ? `https://docs.google.com/spreadsheets/d/${val}/edit` : '');
                          localStorage.setItem('emr_spreadsheet_id', val);
                        }}
                        className="text-xs bg-bg-base"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={!googleAccessToken}
                        onClick={() => handleSaveEMR(false)}
                        className="shrink-0 text-xs"
                      >
                        Đồng bộ ngay
                      </Button>
                      {spreadsheetUrl && (
                        <a
                          href={spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-emerald-700 hover:bg-slate-50 transition-colors shrink-0"
                          title="Mở Google Sheets"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: X-QUANG & TÀI LIỆU THEO NGÀY (DOCUMENTS)          */}
              {/* ======================================================== */}
              {activeTab === 'documents' && (
                <div className="max-w-5xl mx-auto space-y-6">
                  
                  {/* Top Action Bar for Documents */}
                  <div className="bg-surface p-5 rounded-card border border-border-subtle shadow-soft flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                        <Images className="w-5 h-5 text-primary" />
                        Hồ sơ X-Quang & Hình ảnh theo ngày
                      </h3>
                      <p className="text-xs text-text-muted mt-1">
                        Quản lý phim X-quang Panorama, Periapical, ảnh chụp lâm sàng trước/sau điều trị theo từng đợt khám.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                      {/* Button: Create upload section by date */}
                      <Button 
                        onClick={() => setShowCreateDateModal(true)}
                        className="bg-primary hover:bg-primary-dark text-white text-xs h-9 gap-1.5 shadow-sm"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Tạo mục upload theo ngày
                      </Button>

                      {/* Button: Quick upload for today */}
                      <div className="relative inline-block">
                        <Button 
                          variant="outline"
                          size="sm"
                          className="border-primary/40 text-primary hover:bg-mint text-xs h-9 gap-1.5"
                          onClick={() => quickFileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <UploadCloud className="w-4 h-4" />
                          Tải nhanh hôm nay
                        </Button>
                        <input 
                          ref={quickFileInputRef}
                          type="file" 
                          multiple
                          className="hidden" 
                          onChange={handleQuickUpload} 
                          accept="image/*,.pdf" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Upload Progress Bar */}
                  {uploading && (
                    <div className="bg-mint/80 border border-primary/30 rounded-card p-4 flex items-center justify-between shadow-soft animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                        <div>
                          <p className="text-xs font-bold text-primary">Đang tải lên và xử lý tài liệu...</p>
                          <p className="text-[11px] text-primary/80">
                            {googleAccessToken ? 'Đang lưu vào thư mục Google Drive của bệnh nhân' : 'Đang tối ưu và lưu vào hồ sơ bệnh án'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-primary bg-surface px-2.5 py-1 rounded-full border border-primary/20">
                        {uploadProgress?.current} / {uploadProgress?.total} files
                      </span>
                    </div>
                  )}

                  {/* Drag and Drop Zone Notice */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const files = Array.from(e.dataTransfer.files);
                        const today = new Date().toISOString().split('T')[0];
                        processFilesUpload(files, today, 'Tải lên kéo thả');
                      }
                    }}
                    className={`border-2 border-dashed rounded-card p-4 text-center transition-colors ${
                      dragActive ? 'border-primary bg-mint/30' : 'border-border-subtle bg-bg-base/40 hover:bg-bg-base'
                    }`}
                  >
                    <p className="text-xs text-text-muted">
                      💡 <b>Mẹo:</b> Bạn có thể chọn tải lên nhiều file cùng 1 lúc hoặc kéo thả trực tiếp hình ảnh/phim chụp vào đây.
                    </p>
                  </div>

                  {/* Document Groups List (Grouped by Date) */}
                  <div className="space-y-6">
                    {documents.length === 0 ? (
                      <div className="text-center py-14 bg-surface rounded-card border border-border-subtle border-dashed shadow-soft">
                        <Images className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-text-main">Chưa có mục X-Quang hay tài liệu nào</h4>
                        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                          Hãy bấm vào nút <b>"Tạo mục upload theo ngày"</b> ở trên để thêm phim X-Quang hoặc ảnh chụp cho từng đợt khám của bệnh nhân.
                        </p>
                        <Button 
                          size="sm"
                          className="mt-4 text-xs gap-1.5 shadow-sm"
                          onClick={() => setShowCreateDateModal(true)}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          Tạo đợt chụp đầu tiên
                        </Button>
                      </div>
                    ) : (
                      documents.map((group) => {
                        const formattedDate = new Date(group.date).toLocaleDateString('vi-VN', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric'
                        });

                        return (
                          <div 
                            key={group.id} 
                            className="bg-surface rounded-card border border-border-subtle shadow-soft overflow-hidden transition-all hover:border-slate-300"
                          >
                            {/* Group Date Header */}
                            <div className="bg-bg-base/80 px-4 py-3 border-b border-border-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="p-1.5 bg-mint rounded-md text-primary">
                                  <Calendar className="w-4 h-4" />
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-text-main capitalize">
                                      {formattedDate}
                                    </h4>
                                    {group.title && (
                                      <span className="text-[11px] font-semibold text-primary bg-mint px-2 py-0.5 rounded border border-primary/20">
                                        {group.title}
                                      </span>
                                    )}
                                  </div>
                                  {group.note && (
                                    <p className="text-[11px] text-text-muted mt-0.5">{group.note}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-bold text-text-muted bg-surface px-2 py-1 rounded border border-border-subtle">
                                  {group.files.length} file
                                </span>

                                {/* Upload more to this date button */}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 text-[11px] px-2 gap-1 border-primary/30 text-primary hover:bg-mint"
                                  onClick={() => {
                                    setTargetGroupForUpload(group.id);
                                    targetGroupFileInputRef.current?.click();
                                  }}
                                  title="Tải thêm ảnh vào ngày này"
                                >
                                  <Plus className="w-3 h-3" />
                                  Thêm ảnh vào ngày này
                                </Button>

                                {/* Delete date section button */}
                                <button
                                  onClick={() => handleDeleteGroup(group.id, group.date)}
                                  className="p-1.5 text-text-muted hover:text-error rounded hover:bg-red-50 transition-colors"
                                  title="Xóa mục ngày này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Files Grid inside this date group */}
                            <div className="p-4">
                              {group.files.length === 0 ? (
                                <div className="text-center py-6 text-xs text-text-muted">
                                  Mục ngày này chưa có file nào. Nhấn <b>"Thêm ảnh vào ngày này"</b> để tải ảnh lên.
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                                  {group.files.map((file, fIdx) => {
                                    const isImage = file.type?.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i);

                                    return (
                                      <div 
                                        key={fIdx} 
                                        className="group relative rounded-lg border border-border-subtle bg-bg-base overflow-hidden hover:border-primary hover:shadow-md transition-all flex flex-col"
                                      >
                                        {/* Thumbnail Container */}
                                        <div 
                                          onClick={() => {
                                            if (isImage) {
                                              setPreviewImage({ url: file.url, name: file.name, date: group.date, title: group.title });
                                              setPreviewZoom(1);
                                              setPreviewRotation(0);
                                            } else {
                                              window.open(file.url, '_blank');
                                            }
                                          }}
                                          className="h-32 w-full bg-slate-900/5 flex items-center justify-center cursor-pointer overflow-hidden relative"
                                        >
                                          {isImage ? (
                                            <img 
                                              src={file.url} 
                                              alt={file.name} 
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                              loading="lazy"
                                              onError={(e) => {
                                                // Fallback if image link expired or broken
                                                (e.target as HTMLElement).style.display = 'none';
                                              }}
                                            />
                                          ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-text-muted">
                                              <FileText className="w-10 h-10 text-primary mb-1" />
                                              <span className="text-[10px] font-bold uppercase">PDF / TÀI LIỆU</span>
                                            </div>
                                          )}

                                          {/* Hover Overlay with Action Icons */}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            {isImage && (
                                              <span className="p-1.5 bg-white/90 rounded-full text-slate-800 hover:bg-white shadow-sm" title="Phóng to ảnh">
                                                <Eye className="w-3.5 h-3.5" />
                                              </span>
                                            )}
                                            <a 
                                              href={file.url} 
                                              download={file.name} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1.5 bg-white/90 rounded-full text-slate-800 hover:bg-white shadow-sm" 
                                              title="Tải về"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                            </a>
                                          </div>
                                        </div>

                                        {/* File Metadata */}
                                        <div className="p-2 flex items-center justify-between gap-1 bg-surface border-t border-border-subtle">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold text-text-main truncate" title={file.name}>
                                              {file.name}
                                            </p>
                                            {file.size && (
                                              <p className="text-[10px] text-text-muted">{file.size}</p>
                                            )}
                                          </div>

                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteFile(group.id, file.url);
                                            }}
                                            className="p-1 text-text-muted hover:text-error hover:bg-red-50 rounded transition-colors shrink-0"
                                            title="Xóa tài liệu này"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Hidden Input for uploading to targeted date group */}
                  <input 
                    ref={targetGroupFileInputRef}
                    type="file" 
                    multiple
                    className="hidden" 
                    onChange={handleUploadToTargetGroup} 
                    accept="image/*,.pdf" 
                  />

                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: CHI PHÍ & THANH TOÁN (FINANCE)                    */}
              {/* ======================================================== */}
              {activeTab === 'finance' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-surface p-6 lg:p-8 rounded-card border border-border-subtle shadow-soft print:shadow-none print:border-none print:p-0">
                    
                    {/* Printable Receipt Header */}
                    <div className="hidden print:block text-center mb-6 border-b border-slate-300 pb-4">
                      <h1 className="text-xl font-bold uppercase">NHA KHOA DENTAL SMART</h1>
                      <p className="text-xs text-text-muted mt-0.5">PHIẾU THU & BẢNG KÊ CÔNG NỢ BỆNH NHÂN</p>
                      <p className="text-xs mt-2">
                        Khách hàng: <b>{selectedPatient.fullName}</b> — SĐT: {selectedPatient.phone} — Ngày: {new Date().toLocaleDateString('vi-VN')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mb-6 border-b border-border-subtle pb-4 print:hidden">
                      <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-primary" />
                        Quản lý Chi phí & Quyết toán công nợ
                      </h3>
                      <span className="text-xs text-text-muted">Cập nhật công nợ sau mỗi lần khám</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* Old Debt */}
                      <div className="bg-bg-base p-4 rounded-lg border border-border-subtle">
                        <span className="text-text-muted font-semibold block mb-1">Công nợ kỳ trước:</span>
                        <p className="font-extrabold text-xl text-text-main">{(Number(debt) || 0).toLocaleString('vi-VN')} đ</p>
                      </div>

                      {/* Today's Fee */}
                      <div className="bg-bg-base p-4 rounded-lg border border-border-subtle print:hidden">
                        <label className="text-text-main font-bold block mb-1.5">Chi phí phát sinh buổi khám này:</label>
                        <Input 
                          type="number" 
                          value={currentServiceCost} 
                          onChange={e => {
                            setCurrentServiceCost(Number(e.target.value) || 0);
                            setIsSaved(false);
                          }} 
                          className="bg-surface font-bold text-base h-10 text-primary"
                          placeholder="0"
                        />
                      </div>

                      {/* Total to pay */}
                      <div className="col-span-1 md:col-span-2 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-text-main font-bold text-sm">Tổng cộng cần thanh toán:</span>
                        <p className="text-2xl font-black text-error">
                          {((Number(debt) || 0) + (Number(currentServiceCost) || 0)).toLocaleString('vi-VN')} đ
                        </p>
                      </div>

                      {/* Payment Inputs */}
                      <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 print:hidden">
                        <div>
                          <label className="text-text-main font-bold block mb-1.5">Số tiền khách thanh toán hôm nay:</label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              value={paidAmount} 
                              onChange={e => {
                                setPaidAmount(Number(e.target.value) || 0);
                                setIsSaved(false);
                              }} 
                              className="bg-surface flex-1 font-bold text-base h-10 text-green-700"
                              placeholder="0"
                            />
                            <select 
                              className="border border-border-subtle rounded-input px-3 bg-surface text-xs font-semibold focus:outline-none focus:border-primary"
                              value={paymentMethod}
                              onChange={e => setPaymentMethod(e.target.value)}
                            >
                              <option value="Tiền mặt">Tiền mặt</option>
                              <option value="Chuyển khoản">Chuyển khoản</option>
                              <option value="Quẹt thẻ">Quẹt thẻ</option>
                            </select>
                          </div>
                        </div>

                        {/* Calculated Remaining Debt */}
                        <div className="flex flex-col justify-center bg-mint/30 p-4 rounded-lg border border-primary/20">
                          <span className="text-text-main font-bold block text-xs">Công nợ mới (còn lại sau thanh toán):</span>
                          <p className={`font-black text-xl mt-1 ${
                            ((Number(debt) || 0) + (Number(currentServiceCost) || 0) - (Number(paidAmount) || 0)) > 0 ? 'text-error' : 'text-green-700'
                          }`}>
                            {Math.max(0, (Number(debt) || 0) + (Number(currentServiceCost) || 0) - (Number(paidAmount) || 0)).toLocaleString('vi-VN')} đ
                          </p>
                        </div>
                      </div>

                      {/* Print-only details */}
                      <div className="hidden print:block col-span-2 space-y-2 mt-4 border-t pt-4">
                        <div className="flex justify-between py-1">
                          <span>Chi phí hôm nay:</span>
                          <b>{(Number(currentServiceCost) || 0).toLocaleString('vi-VN')} đ</b>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Đã thanh toán ({paymentMethod}):</span>
                          <b>{(Number(paidAmount) || 0).toLocaleString('vi-VN')} đ</b>
                        </div>
                        <div className="flex justify-between py-1 border-t text-sm">
                          <span>Công nợ còn lại:</span>
                          <b>{Math.max(0, (Number(debt) || 0) + (Number(currentServiceCost) || 0) - (Number(paidAmount) || 0)).toLocaleString('vi-VN')} đ</b>
                        </div>
                      </div>

                    </div>

                    {/* Print Signature Section */}
                    <div className="hidden print:flex justify-between mt-12 pt-8 text-center text-xs">
                      <div className="w-1/2">
                        <p className="font-bold">Khách hàng / Bệnh nhân</p>
                        <p className="text-text-muted mt-1">(Ký & ghi rõ họ tên)</p>
                      </div>
                      <div className="w-1/2">
                        <p className="font-bold">Đại diện Nha khoa Dental Smart</p>
                        <p className="text-text-muted mt-1">(Ký & ghi rõ họ tên)</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-8 flex justify-end gap-3 print:hidden border-t border-border-subtle pt-4">
                      
                      <Button 
                        variant="outline"
                        onClick={() => setDocumentViewerState({ isOpen: true, type: 'receipt' })} 
                        className="text-xs gap-1.5 bg-white"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        In phiếu thu
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          // setTelegramIdInput(selectedPatient?.telegramId || '');
                          // setShowTelegramModal('receipt');
                        }} 
                        className="text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 bg-white"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Gửi Telegram
                      </Button>

                      <Button 
                        onClick={() => handleSaveEMR(false)} 
                        disabled={loading}
                        className="text-xs gap-1.5 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Lưu thanh toán & Công nợ
                      </Button>
                    </div>

                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 4: LỊCH SỬ HẸN KHÁM (APPOINTMENTS)                   */}
              {/* ======================================================== */}
              {activeTab === 'appointments' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="bg-surface p-5 rounded-card border border-border-subtle shadow-soft">
                    <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
                      <div>
                        <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                          <CalendarClock className="w-5 h-5 text-primary" />
                          Lịch sử hẹn khám của bệnh nhân
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                          Tất cả các lần đăng ký khám và điều trị tại phòng khám
                        </p>
                      </div>
                      <a 
                        href="/booking" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-btn hover:bg-primary-dark transition-colors shadow-sm"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Đặt lịch mới
                      </a>
                    </div>

                    {patientAppointments.length === 0 ? (
                      <div className="text-center py-12 text-text-muted">
                        <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-medium">Chưa ghi nhận lịch hẹn nào cho bệnh nhân này</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {patientAppointments.map((apt) => (
                          <div 
                            key={apt.id} 
                            className="p-3.5 rounded-lg border border-border-subtle bg-bg-base/60 flex items-center justify-between text-xs gap-3 hover:bg-bg-base transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-mint text-primary flex items-center justify-center font-bold">
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-text-main">{apt.date}</span>
                                  <span className="text-text-muted font-medium">• {apt.time}</span>
                                </div>
                                <p className="text-text-muted text-[11px] mt-0.5">
                                  Dịch vụ: <b className="text-text-main">{apt.serviceName || apt.service}</b>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                apt.status === 'checked-in' ? 'bg-green-50 text-green-700 border border-green-200' :
                                apt.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                apt.status === 'cancelled' ? 'bg-red-50 text-error border border-red-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {apt.status === 'checked-in' ? 'Đã check-in' :
                                 apt.status === 'confirmed' ? 'Đã xác nhận' :
                                 apt.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          /* Empty selection state */
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-bg-base p-6">
            <div className="bg-surface p-6 rounded-full shadow-soft mb-4 border border-border-subtle">
              <ClipboardList className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-text-main mb-1">Chưa chọn hồ sơ bệnh nhân</h3>
            <p className="max-w-xs text-center text-xs text-text-muted mb-4">
              Vui lòng chọn một bệnh nhân từ danh sách bên trái hoặc bấm "Thêm" để tạo mới hồ sơ bệnh án.
            </p>
            <Button size="sm" onClick={() => setShowNewPatientModal(true)} className="gap-1.5 text-xs shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Thêm bệnh nhân mới
            </Button>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: TẠO MỤC UPLOAD THEO NGÀY (CREATE DATE SECTION)    */}
      {/* ======================================================== */}
      {showCreateDateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface rounded-card w-full max-w-lg p-6 shadow-2xl border border-border-subtle relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between mb-5 border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-primary" />
                Tạo mục upload tài liệu theo ngày
              </h3>
              <button 
                onClick={() => setShowCreateDateModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDateSection} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-text-main block mb-1.5">
                  Ngày đợt khám / Chụp X-Quang <span className="text-error">*</span>
                </label>
                <Input 
                  type="date"
                  value={newSectionDate}
                  onChange={e => setNewSectionDate(e.target.value)}
                  className="bg-bg-base font-medium text-xs h-10"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-main block mb-1.5">
                  Tên mục / Loại phim chụp
                </label>
                <div className="space-y-2">
                  <Input 
                    value={newSectionTitle}
                    onChange={e => setNewSectionTitle(e.target.value)}
                    placeholder="VD: Chụp X-quang Panorama toàn hàm..."
                    className="bg-bg-base text-xs h-10"
                  />
                  {/* Quick tag suggestions */}
                  <div className="flex gap-1.5 flex-wrap">
                    {['X-Quang Panorama', 'Phim cận chóp', 'Ảnh trước điều trị', 'Ảnh sau điều trị', 'Xét nghiệm máu'].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setNewSectionTitle(tag)}
                        className="text-[10px] font-medium bg-bg-base hover:bg-mint hover:text-primary px-2 py-0.5 rounded border border-border-subtle transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-main block mb-1.5">
                  Ghi chú lâm sàng cho đợt chụp này (tùy chọn)
                </label>
                <textarea 
                  value={newSectionNote}
                  onChange={e => setNewSectionNote(e.target.value)}
                  placeholder="Ghi chú thêm về góc chụp, răng mục tiêu hoặc đánh giá ban đầu..."
                  className="w-full h-18 rounded-input border border-border-subtle bg-bg-base px-3 py-2 text-xs text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              {/* Multi-file selection */}
              <div>
                <label className="font-bold text-text-main block mb-1.5 flex items-center justify-between">
                  <span>Chọn các file / hình ảnh tải lên ngay</span>
                  <span className="text-text-muted font-normal">Có thể chọn nhiều file 1 lần</span>
                </label>
                <div 
                  onClick={() => newSectionFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border-subtle rounded-lg p-5 text-center cursor-pointer hover:border-primary hover:bg-mint/20 transition-all"
                >
                  <UploadCloud className="w-8 h-8 text-primary mx-auto mb-1.5" />
                  <p className="font-bold text-text-main">Bấm vào đây để chọn nhiều file</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Hỗ trợ PNG, JPG, JPEG, WEBP, PDF</p>
                  <input 
                    ref={newSectionFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewSectionFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                </div>

                {/* Selected files preview count */}
                {newSectionFiles.length > 0 && (
                  <div className="mt-2.5 p-2 bg-mint/40 rounded border border-primary/20 text-xs text-primary font-medium flex items-center justify-between">
                    <span>Đã chọn <b>{newSectionFiles.length} file</b> sẵn sàng tải lên</span>
                    <button 
                      type="button" 
                      onClick={() => setNewSectionFiles([])}
                      className="text-error hover:underline text-[11px]"
                    >
                      Xóa chọn
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border-subtle">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 text-xs" 
                  onClick={() => setShowCreateDateModal(false)}
                >
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  disabled={uploading}
                  className="flex-1 text-xs gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  {newSectionFiles.length > 0 ? `Tải lên ${newSectionFiles.length} file` : 'Tạo mục trống'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* LIGHTBOX / IMAGE FULLSCREEN VIEWER MODAL                 */}
      {/* ======================================================== */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-between p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          {/* Header */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between text-white p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="font-bold text-sm truncate max-w-md">{previewImage.name}</h4>
              <p className="text-xs text-slate-400">
                {previewImage.title && `${previewImage.title} • `}
                {previewImage.date && `Ngày chụp: ${new Date(previewImage.date).toLocaleDateString('vi-VN')}`}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPreviewZoom(prev => Math.min(prev + 0.25, 3))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPreviewZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Xoay hình"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a 
                href={previewImage.url} 
                download={previewImage.name}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Tải về máy"
              >
                <Download className="w-4 h-4" />
              </a>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image Container with Zoom & Rotation */}
          <div 
            className="flex-1 flex items-center justify-center w-full overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewImage.url} 
              alt={previewImage.name} 
              style={{
                transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                transition: 'transform 0.2s ease-in-out'
              }}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-md shadow-2xl select-none"
            />
          </div>

          {/* Footer note */}
          <div className="text-slate-400 text-xs pb-2">
            Nhấn ra ngoài hoặc bấm ESC để đóng
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: THÊM BỆNH NHÂN MỚI (NEW PATIENT MODAL)           */}
      {/* ======================================================== */}
      {showNewPatientModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface rounded-card w-full max-w-md p-6 shadow-2xl border border-border-subtle relative">
            <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
              <UserRound className="w-5 h-5 text-primary" />
              Thêm bệnh nhân mới
            </h3>
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-main block mb-1">
                  Họ và tên <span className="text-error">*</span>
                </label>
                <Input 
                  value={newPatientName} 
                  onChange={e => setNewPatientName(e.target.value)} 
                  placeholder="Nguyễn Văn A..." 
                  className="bg-bg-base text-xs h-10" 
                />
              </div>
              <div>
                <label className="font-bold text-text-main block mb-1">
                  Số điện thoại <span className="text-error">*</span>
                </label>
                <Input 
                  value={newPatientPhone} 
                  onChange={e => setNewPatientPhone(e.target.value)} 
                  placeholder="09xx xxx xxx" 
                  className="bg-bg-base text-xs h-10" 
                />
              </div>
              <div>
                <label className="font-bold text-text-main block mb-1">
                  Ngày sinh (tùy chọn)
                </label>
                <Input 
                  type="date"
                  value={newPatientDob} 
                  onChange={e => setNewPatientDob(e.target.value)} 
                  className="bg-bg-base text-xs h-10" 
                />
              </div>
              <div>
                <label className="font-bold text-text-main block mb-1">
                  Email (tùy chọn)
                </label>
                <Input 
                  value={newPatientEmail} 
                  onChange={e => setNewPatientEmail(e.target.value)} 
                  placeholder="email@example.com" 
                  className="bg-bg-base text-xs h-10" 
                />
              </div>
            </div>
            <div className="flex gap-2.5 mt-6">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => setShowNewPatientModal(false)}>
                Hủy
              </Button>
              <Button className="flex-1 text-xs shadow-sm" onClick={handleCreatePatient} disabled={loading}>
                Thêm bệnh nhân
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Document Viewer Modal */}
      {documentViewerState.isOpen && documentViewerState.type && selectedPatient && (
        <DocumentViewer 
          isOpen={documentViewerState.isOpen}
          type={documentViewerState.type}
          patient={selectedPatient}
          records={selectedPatient.emr || []}
          receiptData={{
            total: Number(currentServiceCost) || 0,
            paid: Number(paidAmount) || 0,
            newDebt: Math.max(0, (Number(debt) || 0) + (Number(currentServiceCost) || 0) - (Number(paidAmount) || 0)),
            oldDebt: Number(selectedPatient.debt) || 0
          }}
          onClose={() => setDocumentViewerState({isOpen: false, type: null})}
          onSendSuccess={(telegramId) => {
            setSelectedPatient({...selectedPatient, telegramId});
            setPatients(patients.map(p => p.id === selectedPatient.id ? {...p, telegramId} : p));
          }}
        />
      )}
    </div>
  );
}
