import { generateToken } from './server/core/security.js';
console.log(generateToken({ userId: 'fab1405a-4bf4-4d9a-818a-e4ee348e862d', role: 'admin', permissions: ['*'] }));
