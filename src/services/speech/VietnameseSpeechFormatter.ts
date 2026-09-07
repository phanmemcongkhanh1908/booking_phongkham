export function formatVietnameseDate(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `ngày ${day} tháng ${month} năm ${year}`;
  } catch (e) {
    return '';
  }
}

export function formatVietnameseTime(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return '';
    const hours = d.getHours();
    const minutes = d.getMinutes();
    if (minutes === 0) {
      return `${hours} giờ`;
    }
    return `${hours} giờ ${minutes} phút`;
  } catch (e) {
    return '';
  }
}

export function formatBookingSpeech(event: any): string {
  const patientName = event.patientName || 'không xác định';
  const serviceName = event.serviceName || 'không xác định';
  const providerName = event.providerName;
  const time = formatVietnameseTime(event.startAt);
  const date = formatVietnameseDate(event.startAt);

  if (providerName) {
    return `Có khách hàng mới đặt lịch. Khách hàng ${patientName}. Dịch vụ ${serviceName}. Bác sĩ ${providerName}. Thời gian hẹn ${time}, ${date}.`;
  } else {
    return `Có khách hàng mới đặt lịch. Khách hàng ${patientName}. Dịch vụ ${serviceName}. Thời gian hẹn ${time}, ${date}.`;
  }
}
