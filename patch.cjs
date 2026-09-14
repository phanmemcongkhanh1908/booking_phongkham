const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const target = `    const currentOrigin = window.location.origin;
    const directInternal = \`\${currentOrigin}/b/\${cleanSlug}\`;
    const fullLink = \`\${currentOrigin}/booking/\${cleanSlug}\`;
    
    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
    const initialOptions: ShortLinkOption[] = [
      {
        id: 'internal',
        name: 'Link phòng khám (Khuyên dùng)',
        tagline: 'Tên miền chính chủ • 100% Không quảng cáo • Nhận diện thương hiệu',
        url: directInternal,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      },
      {
        id: 'full',
        name: 'Đường dẫn chuẩn (Gốc)',
        tagline: 'Link đầy đủ chuẩn SEO • Phù hợp đăng Website / Fanpage',
        url: fullLink,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'full',
      }
    ];`;

const replacement = `    const currentOrigin = window.location.origin;
    const directInternal = \`\${currentOrigin}/b/\${cleanSlug}\`;
    const fullLink = \`\${currentOrigin}/booking/\${cleanSlug}\`;
    const renderLink = \`https://booking-phongkham.onrender.com/b/\${cleanSlug}\`;
    
    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
    const initialOptions: ShortLinkOption[] = [
      {
        id: 'internal',
        name: 'Link phòng khám (Hiện tại)',
        tagline: 'Link tên miền đang sử dụng • 100% Không quảng cáo',
        url: directInternal,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      },
      {
        id: 'render',
        name: 'Link máy chủ (Render)',
        tagline: 'Tên miền chính thức booking-phongkham.onrender.com • 100% Không quảng cáo',
        url: renderLink,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      },
      {
        id: 'full',
        name: 'Đường dẫn chuẩn (Gốc)',
        tagline: 'Link đầy đủ chuẩn SEO • Phù hợp đăng Website / Fanpage',
        url: fullLink,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'full',
      }
    ];`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Patched frontend options');
