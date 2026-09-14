const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const target1 = `export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
}`;

const replace1 = `export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
  error?: string;
}`;

code = code.replace(target1, replace1);

const initialTarget = `    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
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
    ];`;

const initialReplace = `    // Cung cấp ngay các tùy chọn an toàn tại chỗ trong lúc chờ kết nối mạng
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
      },
      {
        id: 'tinyurl',
        name: 'TinyURL (Toàn cầu)',
        tagline: 'Đang kết nối để khởi tạo đường dẫn rút gọn...',
        url: '...',
        isAdFree: true,
        isDirectRedirect: true,
        type: 'short',
        error: 'Đang tải...'
      }
    ];`;

code = code.replace(initialTarget, initialReplace);

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('Frontend interface updated');
