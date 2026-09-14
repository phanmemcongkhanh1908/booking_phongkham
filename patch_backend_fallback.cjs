const fs = require('fs');
let code = fs.readFileSync('server/services/urlShortener.ts', 'utf8');

const interfaceTarget = `export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
}`;

const interfaceReplacement = `export interface ShortLinkOption {
  id: 'internal' | 'dagd' | 'tinyurl' | 'full' | 'render';
  name: string;
  tagline: string;
  url: string;
  isAdFree: boolean;
  isDirectRedirect: boolean;
  type: 'brand' | 'short' | 'full';
  error?: string; // Bổ sung cờ báo lỗi nếu link này bị trùng lặp trên mạng toàn cầu
}`;

code = code.replace(interfaceTarget, interfaceReplacement);

// We need to rewrite the parallel promises block.
// Instead of complex string replace, I will replace the entire block from `const [tinyUrlRes, dagdRes]` to `const tinyUrl = ...`
const promiseBlockStart = code.indexOf('const [tinyUrlRes, dagdRes] = await Promise.allSettled([');
const promiseBlockEnd = code.indexOf('const renderDomainUrl =');
if (promiseBlockStart === -1 || promiseBlockEnd === -1) {
  console.error('Could not find promise block');
  process.exit(1);
}

const newPromiseBlock = `const [tinyUrlRes, dagdRes] = await Promise.allSettled([
    // 1. TinyURL (Direct 301 redirect, zero ads) with custom alias
    (async () => {
      // Helper function to test an alias
      const tryTiny = async (alias) => {
        const res = await fetchWithTimeout(
          \`https://tinyurl.com/api-create.php?url=\${encodeURIComponent(fullBookingUrl)}&alias=\${encodeURIComponent(alias)}\`,
          { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
          3000
        );
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http')) return text;
        }
        return null;
      };

      let result = await tryTiny(cleanSlug);
      if (result) return { url: result, error: null };
      
      // Fallback 1
      result = await tryTiny(cleanSlug + '-vn');
      if (result) return { url: result, error: null };
      
      // Fallback 2
      result = await tryTiny(cleanSlug + '-booking');
      if (result) return { url: result, error: null };

      return { url: '', error: 'Tên định danh này đã có người khác sử dụng trên toàn cầu' };
    })(),

    // 2. da.gd (Open source, direct 302 redirect, zero ads) with custom shorturl
    (async () => {
      if (cleanSlug.length > 10) return { url: '', error: 'Tên quá dài so với quy định của da.gd (tối đa 10 ký tự)' };
      
      const tryDagd = async (alias) => {
        if (alias.length > 10) return null; // da.gd strictly limits to 10
        const res = await fetchWithTimeout(
          \`https://da.gd/s?url=\${encodeURIComponent(fullBookingUrl)}&shorturl=\${encodeURIComponent(alias)}\`,
          { headers: { 'User-Agent': 'DentalSmartBooking/1.0' } },
          3000
        );
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http') && !text.toLowerCase().includes('error')) return text;
        }
        return null;
      };

      let result = await tryDagd(cleanSlug);
      if (result) return { url: result, error: null };
      
      // Fallback for da.gd if length permits
      if ((cleanSlug + '-vn').length <= 10) {
        result = await tryDagd(cleanSlug + '-vn');
        if (result) return { url: result, error: null };
      }

      return { url: '', error: 'Tên định danh đã bị trùng lặp' };
    })(),
  ]);

  const tinyData = tinyUrlRes.status === 'fulfilled' ? tinyUrlRes.value : { url: '', error: 'Lỗi kết nối máy chủ TinyURL' };
  const dagdData = dagdRes.status === 'fulfilled' ? dagdRes.value : { url: '', error: 'Lỗi kết nối máy chủ da.gd' };
  
  `;

code = code.substring(0, promiseBlockStart) + newPromiseBlock + code.substring(promiseBlockEnd);

// Now update how options are pushed
const pushBlockStart = code.indexOf('if (dagdUrl) {');
const pushBlockEnd = code.indexOf('// Deduplicate by URL');
if (pushBlockStart === -1 || pushBlockEnd === -1) {
  console.error('Could not find push block');
  process.exit(1);
}

const newPushBlock = `
  options.push({
    id: 'dagd',
    name: 'da.gd (Siêu ngắn)',
    tagline: 'Mã nguồn mở • 302 Chuyển hướng tức thì',
    url: dagdData.url || 'https://da.gd/...',
    isAdFree: true,
    isDirectRedirect: true,
    type: 'short',
    error: dagdData.error || undefined
  });

  options.push({
    id: 'tinyurl',
    name: 'TinyURL (Toàn cầu)',
    tagline: 'Dịch vụ uy tín từ 2002 • 301 Chuyển hướng trực tiếp',
    url: tinyData.url || 'https://tinyurl.com/...',
    isAdFree: true,
    isDirectRedirect: true,
    type: 'short',
    error: tinyData.error || undefined
  });

  `;

code = code.substring(0, pushBlockStart) + newPushBlock + code.substring(pushBlockEnd);

fs.writeFileSync('server/services/urlShortener.ts', code);
console.log('Backend fallback logic applied');
