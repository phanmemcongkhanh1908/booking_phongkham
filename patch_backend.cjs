const fs = require('fs');
let code = fs.readFileSync('server/services/urlShortener.ts', 'utf8');

const targetArray = `  const options: ShortLinkOption[] = [
    {
      id: 'internal',
      name: 'Link phòng khám (Hiện tại)',
      tagline: 'Link tên miền đang sử dụng • 100% Không quảng cáo',
      url: internalShortUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    },
    {
      id: 'render',
      name: 'Link máy chủ (Render)',
      tagline: 'Tên miền chính thức booking-phongkham.onrender.com • 100% Không quảng cáo',
      url: renderDomainUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    }
  ];

  if (dagdUrl) {
    options.push({
      id: 'dagd',
      name: 'da.gd (Siêu ngắn)',
      tagline: 'Mã nguồn mở • 302 Chuyển hướng tức thì • Không quảng cáo',
      url: dagdUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'short',
    });
  }

  if (tinyUrl) {
    options.push({
      id: 'tinyurl',
      name: 'TinyURL (Toàn cầu)',
      tagline: 'Dịch vụ uy tín từ 2002 • 301 Chuyển hướng trực tiếp • Không quảng cáo',
      url: tinyUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'short',
    });
  }

  options.push({
    id: 'full',
    name: 'Đường dẫn chuẩn (Gốc)',
    tagline: 'Link đầy đủ chuẩn SEO • Phù hợp đăng Website / Fanpage',
    url: fullBookingUrl,
    isAdFree: true,
    isDirectRedirect: true,
    type: 'full',
  });`;

const replacement = `  let options: ShortLinkOption[] = [
    {
      id: 'internal',
      name: 'Link phòng khám (Hiện tại)',
      tagline: 'Tên miền đang truy cập • 100% Không quảng cáo',
      url: internalShortUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    },
    {
      id: 'render',
      name: 'Link máy chủ (Gốc)',
      tagline: 'Tên miền chính thức booking-phongkham.onrender.com',
      url: renderDomainUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'brand',
    }
  ];

  if (dagdUrl) {
    options.push({
      id: 'dagd',
      name: 'da.gd (Siêu ngắn)',
      tagline: 'Mã nguồn mở • 302 Chuyển hướng tức thì',
      url: dagdUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'short',
    });
  }

  if (tinyUrl) {
    options.push({
      id: 'tinyurl',
      name: 'TinyURL (Toàn cầu)',
      tagline: 'Dịch vụ uy tín từ 2002 • 301 Chuyển hướng trực tiếp',
      url: tinyUrl,
      isAdFree: true,
      isDirectRedirect: true,
      type: 'short',
    });
  }

  // Deduplicate by URL (keeps first occurrence, effectively prioritizing 'internal' over 'render' if they match)
  const seenUrls = new Set<string>();
  options = options.filter(opt => {
    // Strip http/https for comparison to be safe
    const urlNormalized = opt.url.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
    if (seenUrls.has(urlNormalized)) {
      return false;
    }
    seenUrls.add(urlNormalized);
    return true;
  });`;

code = code.replace(targetArray, replacement);
fs.writeFileSync('server/services/urlShortener.ts', code);
console.log('Backend patched');
