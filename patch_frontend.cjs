const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const targetArray = `    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
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
    ];

    setLinkOptions(initialOptions);`;

const replacement = `    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
    let initialOptions: ShortLinkOption[] = [
      {
        id: 'internal',
        name: 'Link phòng khám (Hiện tại)',
        tagline: 'Tên miền đang truy cập • 100% Không quảng cáo',
        url: directInternal,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      },
      {
        id: 'render',
        name: 'Link máy chủ (Gốc)',
        tagline: 'Tên miền chính thức booking-phongkham.onrender.com',
        url: renderLink,
        isAdFree: true,
        isDirectRedirect: true,
        type: 'brand',
      }
    ];

    // Deduplicate frontend initial options
    const seenUrls = new Set<string>();
    initialOptions = initialOptions.filter(opt => {
      const urlNormalized = opt.url.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
      if (seenUrls.has(urlNormalized)) return false;
      seenUrls.add(urlNormalized);
      return true;
    });

    setLinkOptions(initialOptions);`;

code = code.replace(targetArray, replacement);
fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Frontend patched');
