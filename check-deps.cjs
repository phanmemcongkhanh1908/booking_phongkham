const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let inUseEffect = false;
  let effectLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect(')) {
      inUseEffect = true;
      effectLines = [lines[i]];
    } else if (inUseEffect) {
      effectLines.push(lines[i]);
      if (lines[i].match(/\}\s*,\s*\[(.*)\]\s*\)/)) {
        inUseEffect = false;
        const match = lines[i].match(/\}\s*,\s*\[(.*)\]\s*\)/);
        console.log(`${filePath}:${i + 1}: [${match[1]}]`);
      } else if (lines[i].match(/\}\s*\)/)) {
        inUseEffect = false;
        console.log(`${filePath}:${i + 1}: NO DEPS OR []? => ${lines[i].trim()}`);
      }
    }
  }
}

function walkSync(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules') {
        walkSync(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkSync('./src');
