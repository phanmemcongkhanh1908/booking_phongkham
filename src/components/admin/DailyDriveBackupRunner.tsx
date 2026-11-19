import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/auth';
import { useGoogleAuthStore } from '../../store/googleAuthStore';
import { runAutoDailyBackupTick } from '../../services/dailyDriveBackup';

export default function DailyDriveBackupRunner() {
  const userToken = useAuthStore((s) => s.token);
  const accessToken = useGoogleAuthStore((s) => s.accessToken);
  const autoEnabled = useGoogleAuthStore((s) => s.autoDailyDriveBackupEnabled);
  const dailyBackupHour = useGoogleAuthStore((s) => s.dailyBackupHour);

  useEffect(() => {
    if (!userToken || !accessToken || !autoEnabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await runAutoDailyBackupTick();
        if (!cancelled && res.ran) {
          toast.success(
            `Đã tự động sao lưu báo cáo tóm tắt ${res.totalAppointments ?? 0} lịch hẹn hôm nay lên Google Drive.`,
            { duration: 5000 }
          );
        }
      } catch (err) {
        console.warn('[DailyDriveBackup] Automatic backup tick failed:', err);
      }
    };

    const bootTimer = setTimeout(() => {
      void tick();
    }, 6000);

    const interval = setInterval(() => {
      void tick();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearTimeout(bootTimer);
      clearInterval(interval);
    };
  }, [userToken, accessToken, autoEnabled, dailyBackupHour]);

  return null;
}
