/**
 * Utility functions for syncing appointments to Google Calendar and downloading .ics files
 */

export interface CalendarAppointmentDetails {
  title?: string;
  serviceName?: string;
  clinicName?: string;
  doctorName?: string;
  patientName?: string;
  patientPhone?: string;
  appointmentId?: string;
  startAt: string | Date;
  endAt?: string | Date | null;
  durationMinutes?: number;
  address?: string;
  phone?: string;
  notes?: string;
}

/**
 * Format ISO Date to Google Calendar / iCal UTC timestamp format: YYYYMMDDTHHmmssZ
 */
export function toUtcCalendarFormat(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Generate a detailed, human-friendly text description for the calendar event
 */
export function formatCalendarDescription(apt: CalendarAppointmentDetails): string {
  const code = apt.appointmentId ? `#${apt.appointmentId.slice(0, 8).toUpperCase()}` : '';
  const lines: string[] = [
    '📋 THÔNG TIN LỊCH HẸN KHÁM NHA KHOA',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    code ? `• Mã tiếp nhận: ${code}` : '',
    apt.serviceName ? `• Dịch vụ khám: ${apt.serviceName}` : '',
    apt.doctorName ? `• Bác sĩ phụ trách: ${apt.doctorName}` : '',
    apt.clinicName ? `• Cơ sở phòng khám: ${apt.clinicName}` : '',
    apt.address ? `• Địa chỉ: ${apt.address}` : '',
    apt.phone ? `• Hotline liên hệ: ${apt.phone}` : '',
    apt.patientName ? `• Bệnh nhân: ${apt.patientName}${apt.patientPhone ? ` (${apt.patientPhone})` : ''}` : '',
    '',
    '⚠️ LƯU Ý QUAN TRỌNG KHI ĐẾN KHÁM:',
    '1. Vui lòng có mặt trước giờ hẹn 10 phút để hoàn tất thủ tục đón tiếp nhanh.',
    '2. Mang theo CCCD/Căn cước công dân hoặc thẻ BHYT (nếu có).',
    code ? `3. Đưa mã tiếp nhận ${code} tại quầy lễ tân để được vào khám ưu tiên không cần bốc số.` : '',
    apt.phone ? `4. Nếu cần dời lịch hoặc hủy hẹn, vui lòng thông báo trước ít nhất 24h qua hotline ${apt.phone}.` : '',
    '',
    '✨ Chúc bạn có một trải nghiệm thăm khám nha khoa êm ái và an tâm!'
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Builds a direct 1-click URL to create an event in the patient's Google Calendar.
 * Works seamlessly on desktop and mobile web/apps.
 */
export function buildGoogleCalendarUrl(apt: CalendarAppointmentDetails): string {
  if (!apt.startAt) return '#';
  const start = new Date(apt.startAt);
  if (isNaN(start.getTime())) return '#';

  const duration = apt.durationMinutes || 45;
  const end = apt.endAt && !isNaN(new Date(apt.endAt).getTime())
    ? new Date(apt.endAt)
    : new Date(start.getTime() + duration * 60 * 1000);

  const startUtc = toUtcCalendarFormat(start);
  const endUtc = toUtcCalendarFormat(end);
  if (!startUtc || !endUtc) return '#';

  const defaultTitle = `🦷 Khám nha khoa: ${apt.serviceName || 'Nha khoa'} - ${apt.clinicName || 'Phòng khám'}`;
  const title = apt.title || defaultTitle;
  const details = formatCalendarDescription(apt);
  const location = apt.address || apt.clinicName || '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startUtc}/${endUtc}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates and triggers download of an .ics (iCalendar) file compatible with:
 * Apple Calendar (iPhone/iPad/Mac), Microsoft Outlook, Google Calendar import, etc.
 */
export function downloadIcsFile(
  apt: CalendarAppointmentDetails,
  customFileName?: string
): void {
  if (!apt.startAt) return;
  const start = new Date(apt.startAt);
  if (isNaN(start.getTime())) return;

  const duration = apt.durationMinutes || 45;
  const end = apt.endAt && !isNaN(new Date(apt.endAt).getTime())
    ? new Date(apt.endAt)
    : new Date(start.getTime() + duration * 60 * 1000);

  const startUtc = toUtcCalendarFormat(start);
  const endUtc = toUtcCalendarFormat(end);
  const stampUtc = toUtcCalendarFormat(new Date());

  const escapeIcs = (str: string) =>
    str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');

  const title = apt.title || `Khám nha khoa: ${apt.serviceName || 'Nha khoa'} - ${apt.clinicName || 'Phòng khám'}`;
  const details = formatCalendarDescription(apt);
  const location = apt.address || apt.clinicName || '';
  const uid = `apt-${apt.appointmentId || Date.now()}@dentalsmartbooking.com`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dental Smart Booking//VN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stampUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(details)}`,
    `LOCATION:${escapeIcs(location)}`,
    'STATUS:CONFIRMED',
    // 2-hour reminder alarm
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Nhắc nhở: Lịch khám ${escapeIcs(apt.serviceName || 'nha khoa')} sau 2 giờ nữa`,
    'END:VALARM',
    // 1-day reminder alarm
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Nhắc nhở: Ngày mai bạn có lịch khám nha khoa tại ${escapeIcs(apt.clinicName || 'phòng khám')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsData = icsLines.join('\r\n');
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const fileName = customFileName || `Lich-hen-${apt.appointmentId ? apt.appointmentId.slice(0, 8) : 'nha-khoa'}.ics`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
