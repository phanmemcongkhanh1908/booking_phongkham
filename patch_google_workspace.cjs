const fs = require('fs');

const path = 'src/lib/googleWorkspace.ts';
let content = fs.readFileSync(path, 'utf8');

const newFn = `
export async function fetchAppointmentsFromSheet(accessToken: string, spreadsheetId: string): Promise<any[]> {
  try {
    const sheetName = 'Lịch hẹn';
    const url = \`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/'\${encodeURIComponent(sheetName)}'!A:J\`;
    const res = await fetch(url, {
      headers: {
        Authorization: \`Bearer \${accessToken}\`
      }
    });
    if (!res.ok) {
      console.warn('Cannot fetch appointments from Lịch hẹn, falling back to Sheet1');
      const fallbackUrl = \`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/Sheet1!A:J\`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          Authorization: \`Bearer \${accessToken}\`
        }
      });
      if (!fallbackRes.ok) return [];
      const data = await fallbackRes.json();
      return data.values || [];
    }
    const data = await res.json();
    return data.values || [];
  } catch(e) {
    console.error('Error fetching from sheets:', e);
    return [];
  }
}
`;

if (!content.includes('fetchAppointmentsFromSheet')) {
    content += '\n' + newFn;
    fs.writeFileSync(path, content);
    console.log('Added fetchAppointmentsFromSheet');
} else {
    console.log('Already exists');
}
