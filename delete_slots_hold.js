import fs from 'fs';
let file = 'server/api/public/index.ts';
let code = fs.readFileSync(file, 'utf8');

const startIdx = code.indexOf('publicRouter.post("/slots/hold"');
if (startIdx !== -1) {
  // It ends somewhere around line 957.
  let endIdx = code.indexOf('});', startIdx);
  while (endIdx !== -1) {
     const nextEnd = code.indexOf('});', endIdx + 3);
     if (nextEnd !== -1 && (nextEnd - endIdx) < 1500) {
        endIdx = nextEnd;
     } else {
        break;
     }
  }
  // just roughly chop the end of file since it's the last route
  const lastRouterExport = code.indexOf('export default publicRouter;', startIdx);
  if (lastRouterExport !== -1) {
    code = code.substring(0, startIdx) + code.substring(lastRouterExport);
  }
}

fs.writeFileSync(file, code);
