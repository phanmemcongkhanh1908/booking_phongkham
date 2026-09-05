const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/Settings.tsx', 'utf8');

const clinicState = `
  const [telegramMsg, setTelegramMsg] = useState('');

  // Clinic Profile State
  const [clinicProfile, setClinicProfile] = useState({
    clinicName: '',
    doctorName: '',
    address: '',
    phone: '',
    workingHours: ''
  });
  const [clinicMsg, setClinicMsg] = useState('');

  useEffect(() => {
`;
content = content.replace(`  const [telegramMsg, setTelegramMsg] = useState('');  useEffect(() => {`, clinicState);

const useEff = `
    api.get('/admin/settings').then(res => {
      const { telegramToken, telegramChatId, clinicProfile } = res.data.data || {};
      if (telegramToken) setTelegramToken(telegramToken);
      if (telegramChatId) setTelegramChatId(telegramChatId);
      if (clinicProfile) setClinicProfile(clinicProfile);
    }).catch(console.error);
`;
content = content.replace(`api.get('/admin/settings').then(res => {      const { telegramToken, telegramChatId } = res.data.data || {};      if (telegramToken) setTelegramToken(telegramToken);      if (telegramChatId) setTelegramChatId(telegramChatId);    }).catch(console.error);`, useEff);


const clinicSave = `
  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setClinicMsg('');
    try {
      await api.post('/admin/settings', { clinicProfile });
      setClinicMsg('Lưu thông tin phòng khám thành công!');
    } catch (err: any) {
      setClinicMsg(err.response?.data?.error?.message || 'Có lỗi xảy ra');
    }
  };

  return (
`;
content = content.replace(`return (`, clinicSave);


const clinicUI = `
      {/* Clinic Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin Phòng khám</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSaveClinic}>
            {clinicMsg && <div className="text-sm text-teal-600 bg-teal-50 p-2 rounded">{clinicMsg}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tên phòng khám</label>
              <Input type="text" value={clinicProfile.clinicName} onChange={e => setClinicProfile({...clinicProfile, clinicName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Bác sĩ phụ trách</label>
              <Input type="text" value={clinicProfile.doctorName} onChange={e => setClinicProfile({...clinicProfile, doctorName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Địa chỉ</label>
              <Input type="text" value={clinicProfile.address} onChange={e => setClinicProfile({...clinicProfile, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Hotline</label>
              <Input type="text" value={clinicProfile.phone} onChange={e => setClinicProfile({...clinicProfile, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Giờ làm việc</label>
              <Input type="text" placeholder="VD: 08:00 - 20:00" value={clinicProfile.workingHours} onChange={e => setClinicProfile({...clinicProfile, workingHours: e.target.value})} />
            </div>
            <Button type="submit">Lưu thông tin</Button>
          </form>
        </CardContent>
      </Card>
`;
content = content.replace(`{/* Telegram Config */}`, clinicUI + `\n      {/* Telegram Config */}`);

fs.writeFileSync('src/pages/admin/Settings.tsx', content, 'utf8');
