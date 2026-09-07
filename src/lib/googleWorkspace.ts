export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export function formatBytes(bytes: string | number | undefined): string {
  if (!bytes) return '0 Bytes';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function fetchDriveQuota(accessToken: string): Promise<DriveQuota | null> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      console.warn('Cannot fetch drive quota:', res.statusText);
      return null;
    }
    const data = await res.json();
    return data.storageQuota || null;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin dung lượng Google Drive:', error);
    return null;
  }
}

export async function findOrCreateFolder(folderName: string, accessToken: string, parentId?: string): Promise<string> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }
  
  // Create folder
  const createMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    createMetadata.parents = [parentId];
  }
  
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createMetadata)
  });
  
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Không thể tạo thư mục Google Drive: ${errText}`);
  }

  const createData = await createRes.json();
  
  // Make folder readable by anyone with link or keep private
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${createData.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch(e) {}
  
  return createData.id;
}

export async function uploadImageToDrive(file: File, accessToken: string, folderId?: string): Promise<string> {
  const metadata: any = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
      const fileData = reader.result;
      
      const body = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';

      const enc = new TextEncoder();
      const bodyTop = enc.encode(body);
      const bodyBottom = enc.encode(close_delim);
      const payload = new Uint8Array(bodyTop.length + (fileData as ArrayBuffer).byteLength + bodyBottom.length);
      payload.set(bodyTop, 0);
      payload.set(new Uint8Array(fileData as ArrayBuffer), bodyTop.length);
      payload.set(bodyBottom, bodyTop.length + (fileData as ArrayBuffer).byteLength);

      try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: payload,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Lỗi tải tệp lên Google Drive: ${errText}`);
        }

        const data = await response.json();
        
        // Ensure read access if needed
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
        } catch(e) {}

        resolve(data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
  });
}

/**
 * Tìm hoặc tự động tạo Google Sheet quản lý Lịch hẹn & Bệnh nhân
 */
export async function findOrCreateClinicSpreadsheet(
  accessToken: string,
  clinicName: string = 'Dental Smart'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; isNew: boolean }> {
  const targetTitle = `${clinicName} - Lịch hẹn & Hồ sơ phòng khám`;

  // 1. Check if sheet with this name already exists in Drive
  try {
    const q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${targetTitle.replace(/'/g, "\\'")}' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const existing = searchData.files[0];
        return {
          spreadsheetId: existing.id,
          spreadsheetUrl: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
          isNew: false
        };
      }
    }
  } catch (e) {
    console.warn('Check existing spreadsheet error:', e);
  }

  // 2. Create new spreadsheet with formatted sheets
  const createPayload = {
    properties: {
      title: targetTitle,
    },
    sheets: [
      {
        properties: {
          title: 'Lịch hẹn',
          gridProperties: {
            frozenRowCount: 1,
          }
        },
      },
      {
        properties: {
          title: 'Hồ sơ bệnh nhân',
          gridProperties: {
            frozenRowCount: 1,
          }
        }
      }
    ]
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Không thể khởi tạo Google Sheet: ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 3. Write header rows to both sheets
  const headersAppointments = [
    [
      'Mã đặt hẹn',
      'Họ và tên',
      'Số điện thoại',
      'Dịch vụ khám',
      'Bác sĩ phụ trách',
      'Thời gian bắt đầu',
      'Trạng thái',
      'Kênh thông báo',
      'Lời nhắn / Triệu chứng',
      'Thời gian cập nhật'
    ]
  ];

  const headersPatients = [
    [
      'Mã bệnh nhân',
      'Họ và tên',
      'Số điện thoại',
      'Công nợ (VNĐ)',
      'Dị ứng thuốc/thức ăn',
      'Ngày chụp X-quang gần nhất',
      'Chẩn đoán & Phác đồ',
      'Thời gian cập nhật'
    ]
  ];

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Lịch hẹn'!A1:J1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: headersAppointments })
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Hồ sơ bệnh nhân'!A1:H1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: headersPatients })
    });
  } catch (err) {
    console.error('Error writing header rows to Google Sheet:', err);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    isNew: true
  };
}

/**
 * Đồng bộ danh sách tất cả các lịch hẹn sang Google Sheets
 */
export async function syncAppointmentsToSheet(
  appointments: any[],
  accessToken: string,
  spreadsheetId: string
): Promise<{ count: number }> {
  if (!appointments || appointments.length === 0) {
    return { count: 0 };
  }

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

  const rows = appointments.map(apt => {
    return [
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
    ];
  });

  // Ensure header exists or append
  const sheetName = 'Lịch hẹn';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A:J:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });

  if (!response.ok) {
    // Fallback try Sheet1 if 'Lịch hẹn' tab wasn't found
    const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:J:append?valueInputOption=USER_ENTERED`;
    const fallbackRes = await fetch(fallbackUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    if (!fallbackRes.ok) {
      const errText = await response.text();
      throw new Error(`Không thể ghi dữ liệu lịch hẹn sang Google Sheets: ${errText}`);
    }
  }

  return { count: rows.length };
}

/**
 * Đồng bộ hồ sơ bệnh nhân sang Google Sheets
 */
export async function syncPatientToSheet(patientData: any, accessToken: string, spreadsheetId: string) {
  const values = [
    [
      patientData.id || '',
      patientData.fullName || '',
      patientData.phone || '',
      patientData.debt ? Number(patientData.debt).toLocaleString('vi-VN') : '0',
      patientData.allergies || 'Không',
      patientData.lastXRayDate || 'Chưa chụp',
      typeof patientData.notes === 'string' ? patientData.notes.slice(0, 500) : (patientData.treatmentPlan || ''),
      new Date().toLocaleString('vi-VN')
    ]
  ];

  const sheetName = 'Hồ sơ bệnh nhân';
  let response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A:H:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    // Fallback to Sheet1
    response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:H:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
  }

  if (!response.ok) {
    throw new Error('Lỗi khi ghi thông tin bệnh nhân sang Google Sheets');
  }

  return response.json();
}
