const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const target = `                            <QRCodeSVG 
                              id="qr-code-canvas"
                              value={currentActiveUrl || \`\${window.location.origin}/b/\${slug}\`} 
                              size={130} 
                              level="M"
                              includeMargin={false}
                              imageSettings={{
                                src: '/vite.svg',
                                x: undefined,
                                y: undefined,
                                height: 26,
                                width: 26,
                                excavate: true,
                              }}
                            />`;

const replacement = `                            <QRCodeSVG 
                              id="qr-code-canvas"
                              value={currentActiveUrl || \`\${window.location.origin}/b/\${slug}\`} 
                              size={130} 
                              level="M"
                              includeMargin={false}
                              fgColor="#0f172a"
                            />`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
console.log('QR code patched');
