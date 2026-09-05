export async function findOrCreateFolder(folderName: string, accessToken: string, parentId?: string): Promise<string> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
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
  
  const createData = await createRes.json();
  
  // Make folder readable so webViewLinks of its files might be easier to view
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
    mimeType: file.type,
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
      
      let body = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + file.type + '\r\n\r\n';

      // We need to concat string and arraybuffer
      const enc = new TextEncoder();
      const bodyTop = enc.encode(body);
      const bodyBottom = enc.encode(close_delim);
      const payload = new Uint8Array(bodyTop.length + (fileData as ArrayBuffer).byteLength + bodyBottom.length);
      payload.set(bodyTop, 0);
      payload.set(new Uint8Array(fileData as ArrayBuffer), bodyTop.length);
      payload.set(bodyBottom, bodyTop.length + (fileData as ArrayBuffer).byteLength);

      try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: payload,
        });

        if (!response.ok) {
          throw new Error('Failed to upload file to Google Drive');
        }

        const data = await response.json();
        
        // Make it readable
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
        } catch(e) {
          console.error("Could not set permission", e);
        }

        resolve(data.webViewLink);
      } catch (err) {
        reject(err);
      }
    };
  });
}

export async function syncPatientToSheet(patientData: any, accessToken: string, spreadsheetId: string) {
  // Sync logic: we assume there is a specific Sheet to append rows to
  // If no spreadsheetId is passed, we might need to create one or prompt user
  const values = [
    [
      patientData.id,
      patientData.fullName,
      patientData.phone,
      patientData.debt,
      patientData.allergies,
      patientData.lastXRayDate,
      new Date().toISOString()
    ]
  ];

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:G:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    throw new Error('Failed to append data to Google Sheets');
  }

  return response.json();
}
