const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  // Match useEffect calls
  let regex = /useEffect\s*\([\s\S]*?\)\s*;/g;
  let matches = code.matchAll(regex);
  for (const match of matches) {
    if (!match[0].includes('[')) {
      console.log(`Missing deps array in ${filePath}`);
    }
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules') walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      checkFile(p);
    }
  }
}
walk('./src');
