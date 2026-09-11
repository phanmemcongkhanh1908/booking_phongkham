const fs = require('fs');
const path = 'src/lib/googleWorkspace.ts';
let content = fs.readFileSync(path, 'utf8');

const newFn = `
export async function forceSyncAppointmentsToSheet(
  appointments: any[],
  accessToken: string,
  spreadsheetId: string
): Promise<{ count: number }> {
  const sheetName = 'Lịch hẹn';
  
  // 1. Clear sheet
  try {
    await fetch(\`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/'\${encodeURIComponent(sheetName)}'!A:J:clear\`, {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${accessToken}\`
      }
    });
  } catch (e) {
    console.warn('Could not clear sheet:', e);
  }

  // 2. Add Headers & Data
  const headers = ['ID', 'Bệnh nhân', 'Số điện thoại', 'Dịch vụ', 'Bác sĩ', 'Giờ khám', 'Trạng thái', 'Thông báo', 'Ghi chú', 'Cập nhật lần cuối'];
  
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

  const rows = [headers];
  appointments.forEach(apt => {
    rows.push([
      apt.id || '',
      apt.patientName || apt.patient?.fullName || '',
      apt.patientPhone || apt.patient?.phone || '',
      apt.serviceTitle || apt.service?.title || '',
      apt.providerName || apt.provider?.name || '',
      apt.startAt ? new Date(apt.startAt).toLocaleString('vi-VN') : '',
      formatStatus(apt.status),
      apt.notificationChannels ? (Array.isArray(apt.notificationChannels) ? apt.notificationChannels.join(', ') : String(apt.notificationChannels)) : 'SMS, Zalo',
      apt.notes || '',
      new Date().toLocaleString('vi-VN')
    ]);
  });

  const url = \`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/'\${encodeURIComponent(sheetName)}'!A:J:append?valueInputOption=USER_ENTERED\`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });

  if (!response.ok) {
    throw new Error('Không thể đồng bộ dữ liệu sau khi clear.');
  }

  return { count: appointments.length };
}
`;

if (!content.includes('forceSyncAppointmentsToSheet')) {
    content += '\n' + newFn;
    fs.writeFileSync(path, content);
    console.log('Added forceSyncAppointmentsToSheet');
} else {
    console.log('Already exists');
}
