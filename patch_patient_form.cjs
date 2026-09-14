const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/PatientForm.tsx', 'utf8');

const targetStr = `        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            fullName: prev.fullName || 'Nguyễn Văn Khách Hàng',
            notes: prev.notes || 'Dị ứng thuốc tê Lidocaine. Từng nhổ răng khôn.'
          }));
          setIsRecalling(false);
          setHasRecalled(true);
        }, 1200);`;

const replaceStr = `        setTimeout(() => {
          setFormData(prev => {
            const returnedName = 'Nguyễn Văn Khách Hàng';
            const finalName = prev.fullName || returnedName;
            toast.success(\`Chào mừng anh/chị \${finalName} quay lại! Dữ liệu y khoa đã được đồng bộ.\`, { duration: 4000, icon: '👋' });
            return {
              ...prev,
              fullName: finalName,
              notes: prev.notes || 'Dị ứng thuốc tê Lidocaine. Từng nhổ răng khôn.'
            };
          });
          setIsRecalling(false);
          setHasRecalled(true);
        }, 1200);`;

content = content.replace(targetStr, replaceStr);

// To clarify where files go, let's update the upload text hint.
content = content.replace("PNG, JPG, PDF tối đa 10MB", "PNG, JPG, PDF tối đa 10MB (Hồ sơ sẽ được chuyển thẳng tới Admin)");

fs.writeFileSync('src/pages/public/components/PatientForm.tsx', content);
