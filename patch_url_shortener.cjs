const fs = require('fs');
let code = fs.readFileSync('server/services/urlShortener.ts', 'utf8');

// The cache is defined as:
// const cache = new Map<string, CacheEntry>();

// We will add a setInterval to clean it up every hour.
if (!code.includes('setInterval(() => {')) {
  code += `\n
// Cleanup expired cache entries periodically (Memory Leak Prevention)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Check every 1 hour
`;
}
fs.writeFileSync('server/services/urlShortener.ts', code);
console.log('URL Shortener cache cleanup added.');
