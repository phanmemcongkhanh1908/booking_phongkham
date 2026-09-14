export function sanitizeForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, " và ")
    .replace(/\//g, " xuyệt ")
    .replace(/\+/g, " cộng ")
    .replace(/%/g, " phần trăm ")
    .replace(/-/g, " ")
    .trim();
}

export function generateVietnameseAnnouncement(payload: any): string {
  const patientName = sanitizeForSpeech(payload.patientName || "không xác định");
  const serviceName = sanitizeForSpeech(payload.serviceName || "không xác định");
  const providerName = sanitizeForSpeech(payload.providerName || "");
  
  // Format Date and Time in Asia/Ho_Chi_Minh timezone
  const startDate = new Date(payload.startAt);
  
  // Using Intl.DateTimeFormat to force Ho_Chi_Minh timezone
  const optionsTime: Intl.DateTimeFormatOptions = { 
    hour: 'numeric', minute: 'numeric', 
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false 
  };
  const timeStr = new Intl.DateTimeFormat('vi-VN', optionsTime).format(startDate);
  
  const optionsDate: Intl.DateTimeFormatOptions = { 
    day: 'numeric', month: 'numeric', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh'
  };
  const dateParts = new Intl.DateTimeFormat('vi-VN', optionsDate).formatToParts(startDate);
  
  let day = "", month = "", year = "";
  for (const p of dateParts) {
    if (p.type === 'day') day = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'year') year = p.value;
  }
  
  // Clean time string (e.g. "08:30" -> "8 giờ 30 phút")
  const [h, m] = timeStr.split(':');
  const hNum = parseInt(h, 10);
  const mNum = parseInt(m, 10);
  const timeSpoken = mNum === 0 ? `${hNum} giờ` : `${hNum} giờ ${mNum} phút`;
  const dateSpoken = `ngày ${day} tháng ${month} năm ${year}`;

  if (providerName) {
    return `Thông báo: Có khách hàng mới đặt lịch. Khách hàng ${patientName}. Dịch vụ ${serviceName}. Bác sĩ ${providerName}. Thời gian hẹn ${timeSpoken}, ${dateSpoken}.`;
  } else {
    return `Thông báo: Có khách hàng mới đặt lịch. Khách hàng ${patientName}. Dịch vụ ${serviceName}. Thời gian hẹn ${timeSpoken}, ${dateSpoken}.`;
  }
}

export function generateVietnameseReminderAnnouncement(payload: any, reminderCount: number = 1): string {
  const patientName = sanitizeForSpeech(payload.patientName || "không xác định");
  const serviceName = sanitizeForSpeech(payload.serviceName || "khám nha khoa");
  
  let timeSpoken = "hôm nay";
  try {
    if (payload.startAt) {
      const startDate = new Date(payload.startAt);
      const optionsTime: Intl.DateTimeFormatOptions = { 
        hour: 'numeric', minute: 'numeric', 
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false 
      };
      const timeStr = new Intl.DateTimeFormat('vi-VN', optionsTime).format(startDate);
      const [h, m] = timeStr.split(':');
      const hNum = parseInt(h, 10);
      const mNum = parseInt(m, 10);
      timeSpoken = mNum === 0 ? `${hNum} giờ` : `${hNum} giờ ${mNum} phút`;
    }
  } catch {}

  const countStr = reminderCount > 1 ? ` lần ${reminderCount}` : '';
  return `Nhắc nhở${countStr}: Có lịch hẹn của khách hàng ${patientName}, đặt dịch vụ ${serviceName} lúc ${timeSpoken} chưa được chốt lịch. Quản lý phòng khám vui lòng kiểm tra và xác nhận ngay.`;
}
