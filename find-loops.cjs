const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // very simple heuristic: look for setState inside useEffect where the state is also in the dependency array
  // or object dependencies.
}
