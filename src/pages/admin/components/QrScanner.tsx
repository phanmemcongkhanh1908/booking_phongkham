import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import {
  X,
  Camera,
  SwitchCamera,
  Flashlight,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Phone,
  Stethoscope,
  Sparkles,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface QrScannerProps {
  onScan?: (data: string) => void;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ScannedAppointment {
  id: string;
  startAt: string;
  endAt?: string;
  status: string;
  patientName?: string;
  patientPhone?: string;
  providerName?: string;
  serviceName?: string;
  price?: number;
  durationMins?: number;
  allergies?: string;
  debt?: number;
}

// Synthetic audio chime (Web Audio API - 0ms latency, zero assets)
const playSuccessSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First tone (A5 - 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    // Second chime (E6 - 1318.5Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.32);
  } catch (e) {
    // AudioContext blocked or not supported, ignore silently
  }
};

const formatVND = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
};

export default function QrScanner({ onScan, onClose, onSuccess }: QrScannerProps) {
  // Tabs: 'camera' or 'manual'
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  // Camera State
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Check-in Result State
  const [scannedAppointment, setScannedAppointment] = useState<ScannedAppointment | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'success' | 'already' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Manual Lookup State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ScannedAppointment[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Settings
  const [autoCheckIn, setAutoCheckIn] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);

  // Helper to parse scanned raw string
  const parseQrText = (text: string): string => {
    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === 'checkin' && parsed.id) {
        return parsed.id;
      }
      if (parsed && parsed.id) {
        return parsed.id;
      }
    } catch {
      // Not JSON
    }

    // Check if URL
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const idParam = url.searchParams.get('id') || url.searchParams.get('apt');
        if (idParam) return idParam;
        const segments = url.pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        if (last && last.length >= 8) return last;
      }
    } catch {
      // Not valid URL
    }

    return trimmed;
  };

  // Perform Check-in API call
  const executeCheckIn = async (aptId: string) => {
    setIsProcessing(true);
    try {
      // 1. Fetch appointment details first to give instant clear info
      let aptData: ScannedAppointment | null = null;
      try {
        const res = await api.get(`/appointments/detail/${aptId}`);
        if (res.data?.success && res.data?.data) {
          aptData = res.data.data;
        }
      } catch (err) {
        // Fallback: try public appointment endpoint
        try {
          const pubRes = await api.get(`/public/appointments/${aptId}`);
          if (pubRes.data?.success && pubRes.data?.data) {
            aptData = pubRes.data.data;
          }
        } catch {}
      }

      // If already checked in
      if (aptData && aptData.status === 'CHECKED_IN') {
        setScannedAppointment(aptData);
        setCheckInStatus('already');
        setStatusMessage('Lịch hẹn này đã được Check-in trước đó.');
        playSuccessSound();
        navigator.vibrate?.([60, 40, 60]);
        setIsProcessing(false);
        return;
      }

      // 2. Perform status transition to CHECKED_IN
      const patchRes = await api.patch(`/appointments/${aptId}/status`, { status: 'CHECKED_IN' });
      
      playSuccessSound();
      navigator.vibrate?.([80, 50, 80]);

      if (aptData) {
        setScannedAppointment({ ...aptData, status: 'CHECKED_IN' });
      } else if (patchRes.data?.data) {
        setScannedAppointment(patchRes.data.data);
      } else {
        setScannedAppointment({
          id: aptId,
          startAt: new Date().toISOString(),
          status: 'CHECKED_IN',
          patientName: 'Khách hàng',
        });
      }

      setCheckInStatus('success');
      setStatusMessage('Check-in thành công! Bệnh nhân đã được chuyển vào danh sách tiếp đón.');
      toast.success('Check-in thành công!', { icon: '🎉' });

      // Notify parent listeners
      if (onScan) onScan(aptId);
      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error('Lỗi check-in:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Không thể xác thực mã lịch hẹn';
      setCheckInStatus('error');
      setStatusMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Callback when a QR code is detected
  const handleDecodedText = useCallback(async (decodedText: string) => {
    if (isProcessing) return;
    const cleanId = parseQrText(decodedText);
    if (!cleanId) {
      toast.error('Mã QR không đúng định dạng');
      return;
    }

    // Stop or pause scanning to prevent multiple triggers
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.pause(true);
      } catch (e) {
        console.warn('Cannot pause scanner:', e);
      }
    }

    await executeCheckIn(cleanId);
  }, [isProcessing]);

  // Start Camera
  const startCamera = async (deviceIdOrFacing?: string | { facingMode: string }) => {
    try {
      setCameraError(null);
      setIsScanning(false);

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-camera-viewport", /* verbose= */ false);
      }

      // Check available cameras
      try {
        const devList = await Html5Qrcode.getCameras();
        if (isMountedRef.current && devList && devList.length > 0) {
          setCameras(devList);
          if (!selectedCameraId) {
            // Prefer back camera
            const backCam = devList.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('sau') || c.label.toLowerCase().includes('rear'));
            setSelectedCameraId(backCam ? backCam.id : devList[0].id);
          }
        }
      } catch (err) {
        console.warn('Lỗi lấy danh sách camera:', err);
      }

      const cameraConfig = deviceIdOrFacing || (selectedCameraId ? selectedCameraId : { facingMode: facingMode });

      await html5QrCodeRef.current.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.floor(minEdge * 0.72);
            return { width: Math.max(qrEdge, 220), height: Math.max(qrEdge, 220) };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Ignore individual frame miss
        }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
        // Check torch support
        try {
          const caps = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
          if (caps && typeof (caps as any).torchFeature === 'function') {
            setTorchSupported((caps as any).torchFeature().isSupported());
          }
        } catch {
          setTorchSupported(false);
        }
      }
    } catch (err: any) {
      console.error('Lỗi khởi động camera:', err);
      if (isMountedRef.current) {
        setIsScanning(false);
        setCameraError(
          err?.message ||
          'Không thể khởi động camera. Vui lòng cấp quyền truy cập máy ảnh hoặc chuyển sang nhập mã thủ công.'
        );
      }
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Lỗi khi dừng scanner:', err);
      }
    }
    setIsScanning(false);
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning) return;
    try {
      const nextTorch = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Không thể bật đèn pin:', err);
      toast.error('Thiết bị không hỗ trợ đèn Flash');
    }
  };

  // Flip Camera (Front / Back)
  const toggleFacingMode = async () => {
    await stopCamera();
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedCameraId('');
    startCamera({ facingMode: nextMode });
  };

  // Scan from Image File
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      toast.loading('Đang phân tích hình ảnh...', { id: 'file-scan' });

      // Stop camera if running to avoid conflicts
      await stopCamera();

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-camera-viewport", false);
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, /* showImage= */ false);
      toast.dismiss('file-scan');
      await handleDecodedText(decodedText);
    } catch (err) {
      toast.dismiss('file-scan');
      toast.error('Không tìm thấy mã QR hợp lệ trong hình ảnh này');
      console.error('Lỗi đọc ảnh QR:', err);
      // Restart camera
      startCamera();
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Resume or Next Scan
  const handleResetForNextScan = async () => {
    setScannedAppointment(null);
    setCheckInStatus('idle');
    setStatusMessage('');

    if (activeTab === 'camera') {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.resume();
          return;
        } catch {
          // Restart clean
          await stopCamera();
          startCamera();
        }
      } else {
        startCamera();
      }
    }
  };

  // Manual Search Effect
  useEffect(() => {
    if (activeTab !== 'manual') return;
    const term = searchTerm.trim();
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/appointments/lookup/${encodeURIComponent(term)}`);
        if (res.data?.success && Array.isArray(res.data.data)) {
          setSearchResults(res.data.data);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Lỗi tìm kiếm lịch hẹn:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  // Mount & Unmount Camera lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    if (activeTab === 'camera' && checkInStatus === 'idle') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [activeTab]);

  // Keyboard shortcut ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/70 text-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative flex flex-col my-auto max-h-[95vh]">
        
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-tight flex items-center gap-2">
                Quét Mã Check-in
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Live
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tiếp đón bệnh nhân tự động bằng QR Code hoặc SĐT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors focus:outline-none"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Navigation */}
        <div className="px-5 pt-3 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('camera');
                handleResetForNextScan();
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'camera'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera / Ảnh QR</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('manual');
                stopCamera();
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'manual'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Nhập Thủ Công</span>
            </button>
          </div>
        </div>

        {/* Main Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: CAMERA SCANNER */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              
              {/* If an appointment was scanned, show the confirmation card instead of the camera */}
              {checkInStatus !== 'idle' && scannedAppointment ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                    checkInStatus === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-100'
                      : checkInStatus === 'already'
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-100'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-100'
                  }`}>
                    <div className="shrink-0 mt-0.5">
                      {checkInStatus === 'success' ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : checkInStatus === 'already' ? (
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                          <Clock className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1">
                      <h4 className="font-bold text-sm">
                        {checkInStatus === 'success'
                          ? 'Đã Check-in Thành Công!'
                          : checkInStatus === 'already'
                          ? 'Đã Check-in Từ Trước'
                          : 'Check-in Thất Bại'}
                      </h4>
                      <p className="text-xs opacity-90 leading-relaxed">
                        {statusMessage}
                      </p>
                    </div>
                  </div>

                  {/* Patient Info Card */}
                  <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
                      <div>
                        <span className="text-[10px] text-teal-400 uppercase font-bold tracking-wider block">
                          Bệnh nhân tiếp đón
                        </span>
                        <h4 className="text-base font-extrabold text-white mt-0.5">
                          {scannedAppointment.patientName || 'Khách vãng lai'}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {scannedAppointment.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-white">
                          {scannedAppointment.patientPhone || '---'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {scannedAppointment.startAt
                            ? format(parseISO(scannedAppointment.startAt), 'HH:mm - dd/MM', { locale: vi })
                            : 'Hôm nay'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300 col-span-2">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="truncate">
                          Dịch vụ: <strong className="text-white">{scannedAppointment.serviceName || 'Nha khoa'}</strong>
                          {scannedAppointment.price ? ` (${formatVND(scannedAppointment.price)})` : ''}
                        </span>
                      </div>

                      {scannedAppointment.providerName && (
                        <div className="flex items-center gap-2 text-slate-300 col-span-2">
                          <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Bác sĩ: <strong>BS. {scannedAppointment.providerName}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleResetForNextScan}
                      className="py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Quét lượt tiếp theo</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center"
                    >
                      Hoàn tất & Đóng
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Viewfinder Container */
                <div className="space-y-3">
                  <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-3xl overflow-hidden bg-black border-2 border-slate-700 shadow-inner flex items-center justify-center">
                    {/* The camera video target */}
                    <div id="qr-camera-viewport" className="w-full h-full object-cover"></div>

                    {/* Laser overlay & Corner Targets */}
                    {isScanning && !cameraError && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        
                        {/* Target Box (70% width) */}
                        <div className="relative w-[72%] h-[72%]">
                          {/* Top-Left Corner */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-xl shadow-sm"></div>
                          {/* Top-Right Corner */}
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-xl shadow-sm"></div>
                          {/* Bottom-Left Corner */}
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-xl shadow-sm"></div>
                          {/* Bottom-Right Corner */}
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-xl shadow-sm"></div>

                          {/* Animated Sweeping Laser Bar */}
                          <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_#14b8a6] animate-scan-laser"></div>

                          {/* Central Pulse Dot */}
                          <div className="absolute inset-0 m-auto w-2.5 h-2.5 bg-teal-400 rounded-full animate-ping opacity-60"></div>
                        </div>

                        {/* Tip overlay */}
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] text-teal-300 border border-teal-500/30">
                            <Sparkles className="w-3 h-3 text-teal-400" />
                            Căn mã QR vào giữa khung hình
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Camera Permission / Error Prompt */}
                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Chưa thể truy cập Camera</h4>
                        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                          {cameraError}
                        </p>
                        <div className="pt-2 flex flex-col gap-2 w-full max-w-xs">
                          <button
                            onClick={() => startCamera()}
                            className="py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Thử lại quyền Camera</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('manual')}
                            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                          >
                            Chuyển sang nhập thủ công
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Loading/Starting State */}
                    {!isScanning && !cameraError && (
                      <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-4 text-center space-y-2">
                        <RefreshCw className="w-7 h-7 text-teal-400 animate-spin" />
                        <p className="text-xs text-slate-400">Đang khởi tạo máy ảnh...</p>
                      </div>
                    )}
                  </div>

                  {/* Camera Control Toolbar */}
                  <div className="flex items-center justify-center gap-3 pt-1">
                    {/* Switch Camera */}
                    <button
                      onClick={toggleFacingMode}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-700/60"
                      title="Đổi camera trước / sau"
                    >
                      <SwitchCamera className="w-4 h-4 text-teal-400" />
                      <span className="hidden sm:inline">Đổi camera</span>
                    </button>

                    {/* Torch (if supported) */}
                    {torchSupported && (
                      <button
                        onClick={toggleTorch}
                        className={`p-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all border ${
                          isTorchOn
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
                        }`}
                        title="Bật/Tắt đèn pin"
                      >
                        <Flashlight className="w-4 h-4" />
                        <span>{isTorchOn ? 'Tắt đèn' : 'Bật đèn'}</span>
                      </button>
                    )}

                    {/* Upload Image QR */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-700/60"
                      title="Quét từ file ảnh trong thư viện"
                    >
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>Tải ảnh QR</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileScan}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL SEARCH & CHECK-IN */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm || ''}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nhập số điện thoại (vd: 0912...) hoặc Mã lịch hẹn..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  autoFocus
                />
                {isSearching && (
                  <RefreshCw className="w-4 h-4 text-teal-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Instructions or Empty State */}
              {!searchTerm && (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-teal-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs">
                    Nhập số điện thoại bệnh nhân để tìm nhanh lịch hẹn trong ngày và thực hiện check-in ngay.
                  </p>
                </div>
              )}

              {/* Search Results List */}
              {searchTerm && searchResults.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <span className="text-[11px] text-slate-400 font-semibold px-1 block">
                    Tìm thấy {searchResults.length} lịch hẹn:
                  </span>

                  {searchResults.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3.5 bg-slate-800/90 border border-slate-700/80 rounded-2xl hover:border-teal-500/50 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                            {apt.patientName || 'Khách hàng'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            apt.status === 'CHECKED_IN'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          }`}>
                            {apt.status === 'CHECKED_IN' ? 'Đã Check-in' : apt.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span>{apt.patientPhone}</span>
                          <span>•</span>
                          <span className="truncate">{apt.serviceName}</span>
                        </div>

                        <div className="text-[10px] text-teal-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {apt.startAt ? format(parseISO(apt.startAt), 'HH:mm - dd/MM/yyyy', { locale: vi }) : ''}
                          </span>
                        </div>
                      </div>

                      {apt.status === 'CHECKED_IN' ? (
                        <button
                          disabled
                          className="py-2 px-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold shrink-0 cursor-default"
                        >
                          ✓ Đã vào
                        </button>
                      ) : (
                        <button
                          onClick={() => executeCheckIn(apt.id)}
                          disabled={isProcessing}
                          className="py-2 px-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
                        >
                          <span>Check-in</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchTerm && !isSearching && searchResults.length === 0 && (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl space-y-1">
                  <p className="text-xs font-semibold text-slate-300">Không tìm thấy lịch hẹn phù hợp</p>
                  <p className="text-[11px] text-slate-500">
                    Vui lòng kiểm tra lại số điện thoại hoặc mã hẹn của khách.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Guidance */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Hỗ trợ QR thẻ hẹn, ảnh Zalo, mã đặt online
          </span>
          <button
            onClick={onClose}
            className="hover:text-white transition-colors"
          >
            Đóng [ESC]
          </button>
        </div>

      </div>
    </div>
  );
}
