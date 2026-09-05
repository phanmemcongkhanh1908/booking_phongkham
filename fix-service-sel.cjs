const fs = require('fs');

let content = fs.readFileSync('src/pages/public/components/ServiceSelection.tsx', 'utf8');

// The original closing tags were:
//             <div className="relative z-10 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-teal-50 transition-colors">
//               <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
//             </div>
//           </button>
//         ))}
//       </CardContent>

// The error says Unexpected closing "div" tag does not match opening "button" tag.
content = content.replace("</div>\n          ))}\n      </CardContent>", "</button>\n        ))}\n      </CardContent>");

// Revert previous naive replace
// Actually let's just rewrite the return part of ServiceSelection.tsx
const rewrite = `
  return (
    <Card className="border-0 shadow-none sm:border sm:border-slate-200 sm:shadow-lg sm:shadow-slate-200/40 rounded-2xl overflow-hidden bg-white">
      <CardHeader className="text-center sm:text-left bg-gradient-to-b from-slate-50 to-white pb-6 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shadow-sm border border-teal-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl md:text-2xl text-slate-800 font-bold">Chọn dịch vụ khám</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Lựa chọn dịch vụ phù hợp để chúng tôi chuẩn bị tốt nhất.</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="grid gap-3 md:gap-4 sm:grid-cols-2 p-4 md:p-6 bg-slate-50/50">
        {services.map((svc) => (
          <button
            key={svc.id}
            type="button"
            onClick={() => setService(svc.id, svc.name)}
            className="group text-left w-full relative flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-xl hover:shadow-teal-900/5 overflow-hidden"
          >
            {/* Subtle background glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:shadow-md">
                <Stethoscope size={22} />
              </div>
              <div className="flex flex-col">
                <h4 className="font-semibold text-slate-800 text-base group-hover:text-primary transition-colors">{svc.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                    ~{svc.durationMins} phút
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    • {svc.price ? \`\${svc.price.toLocaleString()}đ\` : 'Miễn phí'}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative z-10 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-teal-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
`;

const match = content.match(/return \([\s\S]*?\);/);
if (match) {
  content = content.replace(match[0], rewrite.trim());
  fs.writeFileSync('src/pages/public/components/ServiceSelection.tsx', content);
}
