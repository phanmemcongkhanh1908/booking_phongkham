const fs = require('fs');
let code = fs.readFileSync('server/db/index.js', 'utf8').replace('index.ts', 'index.js'); // Wait, it's index.ts!
