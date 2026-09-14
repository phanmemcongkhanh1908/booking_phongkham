const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/DateTimeSelection.tsx', 'utf8');

const oldEnhance = `  // Enhance doctors with fake premium profiles
  const extendedProviders = useMemo(() => {
    return providers.map((p, idx) => ({
      ...p,
      experience: p.experience || (10 + idx * 2) + ' năm kinh nghiệm',
      specialties: p.specialties || ['Chỉnh nha', 'Implant nha khoa', 'Răng sứ thẩm mỹ'],
      certificates: p.certificates || ['Chứng chỉ Cấy ghép Implant (Bộ Y Tế)', 'Chứng chỉ Chỉnh nha Invisalign Hạng Bạch Kim']
    }));
  }, [providers]);`;

const newEnhance = `  // Use real provider data
  const extendedProviders = useMemo(() => {
    return providers.map((p, idx) => ({
      ...p,
      experience: p.experience || '',
      specialties: p.specialties || [],
      certificates: p.certificates || []
    }));
  }, [providers]);`;

content = content.replace(oldEnhance, newEnhance);
fs.writeFileSync('src/pages/public/components/DateTimeSelection.tsx', content);
