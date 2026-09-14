const fs = require('fs');

// 1x1 transparent PNG base64
const emptyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMTnU1rJkAAAADUlEQVQYV2P4//8/AwAI/AL+X6FjGgAAAABJRU5ErkJggg==";
const buffer = Buffer.from(emptyPng, 'base64');

fs.writeFileSync('public/pwa-192x192.png', buffer);
fs.writeFileSync('public/pwa-512x512.png', buffer);
fs.writeFileSync('public/apple-touch-icon.png', buffer);
fs.writeFileSync('public/icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#0d9488"/></svg>');
