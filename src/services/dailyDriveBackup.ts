import api from '../services/api';
import {
  checkDailyBackupFilesInFolder,
  DailyAppointmentSummaryPayload,
  findOrCreateFolder,
  runDailyAppointmentDriveBackup,
} from '../lib/googleWorkspace';
import { useGoogleAuthStore } from '../store/googleAuthStore';

let backupMutex = false;

export function getTodayVnDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getCurrentVnHourMinute(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export async function fetchClinicDailySummary(targetDate?: string): Promise<DailyAppointmentSummaryPayload> {
  const dateStr = targetDate || getTodayVnDateString();
  const res = await api.get('/admin/appointments/daily-summary', {
    params: { date: dateStr },
  });
  if (!res.data?.success || !res.data?.data) {
    throw new Error('Không thể tải dữ liệu tóm tắt lịch hẹn trong ngày.');
  }
  return res.data.data;
}

export async function checkExistingDailyDriveBackup(targetDate?: string): Promise<{
  folderId: string | null;
  existingFiles: Array<{ id: string; name: string; webViewLink?: string }>;
}> {
  const state = useGoogleAuthStore.getState();
  const token = state.accessToken;
  if (!token) {
    return { folderId: state.driveBackupFolderId, existingFiles: [] };
  }
  const dateStr = targetDate || getTodayVnDateString();
  const folderName = state.driveBackupFolderName || 'Dental Smart - Sao lưu Lịch hẹn Hằng ngày';
  const resolvedFolderId =
    state.driveBackupFolderId || (await findOrCreateFolder(folderName, token));

  if (!state.driveBackupFolderId && resolvedFolderId) {
    state.setDailyDriveBackupConfig({ driveBackupFolderId: resolvedFolderId });
  }

  const existingFiles = await checkDailyBackupFilesInFolder(dateStr, resolvedFolderId, token);
  return { folderId: resolvedFolderId, existingFiles };
}

export async function executeDailyDriveSummaryBackup(options?: {
  targetDate?: string;
  isAutomatic?: boolean;
}): Promise<{
  skipped?: boolean;
  date: string;
  folderId: string;
  folderUrl: string;
  fileName: string;
  fileUrl: string;
  totalAppointments: number;
}> {
  if (backupMutex) {
    throw new Error('Tiến trình sao lưu Google Drive đang chạy, vui lòng đợi.');
  }

  const state = useGoogleAuthStore.getState();
  const token = state.accessToken;
  if (!token) {
    throw new Error('Phiên đăng nhập Google Drive đã hết hạn hoặc chưa kết nối.');
  }

  const dateStr = options?.targetDate || getTodayVnDateString();
  backupMutex = true;

  try {
    const summary = await fetchClinicDailySummary(dateStr);
    const result = await runDailyAppointmentDriveBackup({
      accessToken: token,
      summary,
      folderId: state.driveBackupFolderId,
      folderName: state.driveBackupFolderName,
    });

    const backedUpAt = new Date().toISOString();
    state.recordDailyDriveBackupResult({
      date: dateStr,
      folderId: result.folderId,
      fileName: result.csvFile.name,
      fileUrl: result.csvFile.webViewLink,
      totalAppointments: summary.stats.total,
      backedUpAt,
    });

    return {
      date: dateStr,
      folderId: result.folderId,
      folderUrl: result.folderUrl,
      fileName: result.csvFile.name,
      fileUrl: result.csvFile.webViewLink,
      totalAppointments: summary.stats.total,
    };
  } catch (err: any) {
    if (err?.status === 401) {
      useGoogleAuthStore.getState().setAccessToken(null);
    }
    throw err;
  } finally {
    backupMutex = false;
  }
}

export async function runAutoDailyBackupTick(): Promise<{
  ran: boolean;
  fileName?: string;
  totalAppointments?: number;
}> {
  if (backupMutex) return { ran: false };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ran: false };

  const state = useGoogleAuthStore.getState();
  if (!state.autoDailyDriveBackupEnabled || !state.accessToken) {
    return { ran: false };
  }

  const todayStr = getTodayVnDateString();
  if (state.lastDailyBackupDate === todayStr) {
    return { ran: false };
  }

  const currentHm = getCurrentVnHourMinute();
  const scheduledHm = state.dailyBackupHour || '20:00';
  if (currentHm < scheduledHm) {
    return { ran: false };
  }

  // Verify Drive folder doesn't already have today's backup from another admin tab/browser session
  try {
    const { existingFiles } = await checkExistingDailyDriveBackup(todayStr);
    if (existingFiles.length > 0) {
      useGoogleAuthStore.getState().recordDailyDriveBackupResult({
        date: todayStr,
        fileName: existingFiles[0].name,
        fileUrl: existingFiles[0].webViewLink || 'https://drive.google.com',
        totalAppointments: 0,
        backedUpAt: new Date().toISOString(),
      });
      return { ran: false };
    }
  } catch {}

  const res = await executeDailyDriveSummaryBackup({
    targetDate: todayStr,
    isAutomatic: true,
  });

  return {
    ran: true,
    fileName: res.fileName,
    totalAppointments: res.totalAppointments,
  };
}
