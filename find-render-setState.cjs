const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  // Regex to find things like setSomething(...) but not inside arrow functions or function declarations
  // This is hard with regex, let's just search for typical patterns that cause loops:
  
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for lines that call a setter directly
    if (line.match(/\bset[A-Z][a-zA-Z0-9]*\(/)) {
      // Ignore if it's inside a callback/promise/effect/event handler
      if (
        !line.includes('=>') &&
        !line.includes('onClick') &&
        !line.includes('onChange') &&
        !line.includes('onSubmit') &&
        !line.includes('.then(') &&
        !line.includes('.catch(') &&
        !line.includes('setTimeout(') &&
        !line.includes('setInterval(') &&
        !line.match(/const \[.*\] = useState/) &&
        !line.match(/function /)
      ) {
         console.log(`${filePath}:${i+1} - ${line.trim()}`);
      }
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
