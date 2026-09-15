const fs = require('fs');
let code = fs.readFileSync('src/pages/public/Booking.tsx', 'utf8');

const targetStr = `<div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-center justify-between">
                {/* Connector Line Background */}
                <div className="absolute left-5 right-5 sm:left-8 sm:right-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
                
                {/* Active Progress Connector */}
                <div 
                  className="absolute left-5 sm:left-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-teal-700 rounded-full transition-all duration-500 ease-out"
                  style={{ width: \`\${Math.max(0, Math.min(100, ((step - 1) / 3) * 92))}%\` }}
                />`;

const replaceStr = `<div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm overflow-x-auto scrollbar-hide">
            <div className="min-w-[320px] max-w-3xl mx-auto px-2 sm:px-0">
              <div className="relative flex items-center justify-between">
                {/* Connector Line Background */}
                <div className="absolute left-5 right-5 sm:left-8 sm:right-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-slate-100 rounded-full" />
                
                {/* Active Progress Connector */}
                <div 
                  className="absolute left-5 sm:left-8 top-4 sm:top-5.5 -translate-y-1/2 h-1 bg-teal-700 rounded-full transition-all duration-500 ease-out"
                  style={{ width: \`\${Math.max(0, Math.min(100, ((step - 1) / 3) * 92))}%\` }}
                />`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/public/Booking.tsx', code);
console.log('Booking steps updated.');
