const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ServicesConfig.tsx', 'utf8');

const target = `                  {prv.specialty && (
                    <div className="text-xs text-text-muted mt-1">{prv.specialty}</div>
                  )}`;

const newTarget = `                  {prv.specialty && (
                    <div className="text-xs text-text-muted mt-1">{prv.specialty}</div>
                  )}
                  {prv.experience && (
                    <div className="text-[11px] text-teal-600 mt-0.5">{prv.experience}</div>
                  )}`;

content = content.replace(target, newTarget);
fs.writeFileSync('src/pages/admin/ServicesConfig.tsx', content);
