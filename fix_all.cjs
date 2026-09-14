const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

// The original replacement string was:
// `(() => {
// ...
// })()}`

// Which means it looked like this in the file:
// <div>
// (() => {
// ...
// })()}
// </div>

// So it's treating `(() => {` as text, and getting confused by the `<` inside the return statement of renderOption.
// We just need to wrap the IIFE in `{ }`

code = code.replace(
  `                          <div className="w-full">
                            {(() => {`,
  `                          <div className="w-full">
                            {(() => {` // this replace didn't work because in the file it might have been <div>
);

code = code.replace(
  `                          <div>
                            (() => {`,
  `                          <div className="w-full">
                            {(() => {`
);

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
